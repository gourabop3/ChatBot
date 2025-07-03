const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

// Stripe webhook endpoint (must be before raw body parsing middleware)
router.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    try {
        switch (event.type) {
            case 'customer.subscription.created':
                await handleSubscriptionCreated(event.data.object);
                break;
            case 'customer.subscription.updated':
                await handleSubscriptionUpdated(event.data.object);
                break;
            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(event.data.object);
                break;
            case 'invoice.payment_succeeded':
                await handlePaymentSucceeded(event.data.object);
                break;
            case 'invoice.payment_failed':
                await handlePaymentFailed(event.data.object);
                break;
            case 'customer.created':
                console.log('Customer created:', event.data.object.id);
                break;
            default:
                console.log(`Unhandled event type ${event.type}`);
        }

        res.json({received: true});
    } catch (error) {
        console.error('Webhook handling error:', error);
        res.status(500).json({error: 'Webhook handling failed'});
    }
});

// Get pricing plans
router.get('/plans', async (req, res) => {
    try {
        const plans = {
            free: {
                id: 'free',
                name: 'Free',
                price: 0,
                currency: 'usd',
                interval: 'month',
                features: [
                    '3 projects',
                    '100 AI requests/month',
                    'Basic editor features',
                    'Community support'
                ],
                limits: {
                    projects: 3,
                    aiRequests: 100,
                    collaborators: 1,
                    storage: '100MB'
                }
            },
            pro: {
                id: 'price_pro_monthly', // Stripe price ID
                name: 'Pro',
                price: 20,
                currency: 'usd',
                interval: 'month',
                features: [
                    '50 projects',
                    '1000 AI requests/month',
                    'Advanced AI features',
                    'Real-time collaboration',
                    'GitHub integration',
                    'Priority support'
                ],
                limits: {
                    projects: 50,
                    aiRequests: 1000,
                    collaborators: 5,
                    storage: '10GB'
                }
            },
            team: {
                id: 'price_team_monthly', // Stripe price ID
                name: 'Team',
                price: 50,
                currency: 'usd',
                interval: 'month',
                features: [
                    '100 projects',
                    '5000 AI requests/month',
                    'Advanced collaboration',
                    'Team management',
                    'Advanced security',
                    'Dedicated support'
                ],
                limits: {
                    projects: 100,
                    aiRequests: 5000,
                    collaborators: 20,
                    storage: '100GB'
                }
            },
            enterprise: {
                id: 'enterprise',
                name: 'Enterprise',
                price: 'Contact us',
                currency: 'usd',
                interval: 'month',
                features: [
                    'Unlimited projects',
                    'Unlimited AI requests',
                    'Enterprise security',
                    'Custom integrations',
                    'Dedicated account manager',
                    'SLA support'
                ],
                limits: {
                    projects: Infinity,
                    aiRequests: Infinity,
                    collaborators: Infinity,
                    storage: 'Unlimited'
                }
            }
        };

        res.json(plans);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch pricing plans' });
    }
});

// Get current user's billing information
router.get('/billing', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        
        let billingInfo = {
            subscription: user.subscription,
            usage: user.usage
        };

        // If user has a Stripe customer ID, fetch additional info
        if (user.subscription.stripeCustomerId) {
            const customer = await stripe.customers.retrieve(user.subscription.stripeCustomerId);
            const subscriptions = await stripe.subscriptions.list({
                customer: user.subscription.stripeCustomerId,
                status: 'all',
                limit: 10
            });

            billingInfo.customer = {
                email: customer.email,
                name: customer.name,
                defaultPaymentMethod: customer.default_source || customer.invoice_settings?.default_payment_method
            };

            billingInfo.subscriptions = subscriptions.data;

            // Get upcoming invoice if subscription is active
            if (user.subscription.status === 'active' && user.subscription.stripeSubscriptionId) {
                try {
                    const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
                        customer: user.subscription.stripeCustomerId
                    });
                    billingInfo.upcomingInvoice = upcomingInvoice;
                } catch (err) {
                    // Upcoming invoice might not exist
                    console.log('No upcoming invoice found');
                }
            }
        }

        res.json(billingInfo);
    } catch (error) {
        console.error('Billing info error:', error);
        res.status(500).json({ error: 'Failed to fetch billing information' });
    }
});

// Create checkout session for subscription
router.post('/create-checkout-session', 
    auth,
    [
        body('priceId').notEmpty().withMessage('Price ID is required'),
        body('successUrl').isURL().withMessage('Valid success URL is required'),
        body('cancelUrl').isURL().withMessage('Valid cancel URL is required')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { priceId, successUrl, cancelUrl } = req.body;
            const user = await User.findById(req.user.id);

            let customerId = user.subscription.stripeCustomerId;

            // Create customer if doesn't exist
            if (!customerId) {
                const customer = await stripe.customers.create({
                    email: user.email,
                    name: user.fullName,
                    metadata: {
                        userId: user._id.toString()
                    }
                });
                customerId = customer.id;
                
                // Update user with customer ID
                user.subscription.stripeCustomerId = customerId;
                await user.save();
            }

            const session = await stripe.checkout.sessions.create({
                customer: customerId,
                payment_method_types: ['card'],
                line_items: [{
                    price: priceId,
                    quantity: 1,
                }],
                mode: 'subscription',
                success_url: successUrl,
                cancel_url: cancelUrl,
                subscription_data: {
                    metadata: {
                        userId: user._id.toString()
                    }
                }
            });

            res.json({ sessionId: session.id, url: session.url });
        } catch (error) {
            console.error('Checkout session error:', error);
            res.status(500).json({ error: 'Failed to create checkout session' });
        }
    }
);

// Create customer portal session
router.post('/create-portal-session', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        
        if (!user.subscription.stripeCustomerId) {
            return res.status(400).json({ error: 'No billing account found' });
        }

        const session = await stripe.billingPortal.sessions.create({
            customer: user.subscription.stripeCustomerId,
            return_url: req.body.returnUrl || `${process.env.FRONTEND_URL}/dashboard`
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error('Portal session error:', error);
        res.status(500).json({ error: 'Failed to create portal session' });
    }
});

// Cancel subscription
router.post('/cancel-subscription', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        
        if (!user.subscription.stripeSubscriptionId) {
            return res.status(400).json({ error: 'No active subscription found' });
        }

        const subscription = await stripe.subscriptions.update(
            user.subscription.stripeSubscriptionId,
            { cancel_at_period_end: true }
        );

        // Update user subscription status
        user.subscription.status = 'canceled';
        await user.save();

        res.json({ 
            message: 'Subscription will be canceled at the end of the current period',
            subscription 
        });
    } catch (error) {
        console.error('Cancel subscription error:', error);
        res.status(500).json({ error: 'Failed to cancel subscription' });
    }
});

// Reactivate subscription
router.post('/reactivate-subscription', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        
        if (!user.subscription.stripeSubscriptionId) {
            return res.status(400).json({ error: 'No subscription found' });
        }

        const subscription = await stripe.subscriptions.update(
            user.subscription.stripeSubscriptionId,
            { cancel_at_period_end: false }
        );

        // Update user subscription status
        user.subscription.status = 'active';
        await user.save();

        res.json({ 
            message: 'Subscription reactivated',
            subscription 
        });
    } catch (error) {
        console.error('Reactivate subscription error:', error);
        res.status(500).json({ error: 'Failed to reactivate subscription' });
    }
});

// Get invoices
router.get('/invoices', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        
        if (!user.subscription.stripeCustomerId) {
            return res.json({ invoices: [] });
        }

        const invoices = await stripe.invoices.list({
            customer: user.subscription.stripeCustomerId,
            limit: 20
        });

        res.json({ invoices: invoices.data });
    } catch (error) {
        console.error('Invoices error:', error);
        res.status(500).json({ error: 'Failed to fetch invoices' });
    }
});

// Get payment methods
router.get('/payment-methods', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        
        if (!user.subscription.stripeCustomerId) {
            return res.json({ paymentMethods: [] });
        }

        const paymentMethods = await stripe.paymentMethods.list({
            customer: user.subscription.stripeCustomerId,
            type: 'card'
        });

        res.json({ paymentMethods: paymentMethods.data });
    } catch (error) {
        console.error('Payment methods error:', error);
        res.status(500).json({ error: 'Failed to fetch payment methods' });
    }
});

// Add payment method
router.post('/add-payment-method', auth, async (req, res) => {
    try {
        const { paymentMethodId } = req.body;
        const user = await User.findById(req.user.id);
        
        if (!user.subscription.stripeCustomerId) {
            return res.status(400).json({ error: 'No customer account found' });
        }

        // Attach payment method to customer
        await stripe.paymentMethods.attach(paymentMethodId, {
            customer: user.subscription.stripeCustomerId,
        });

        // Set as default payment method
        await stripe.customers.update(user.subscription.stripeCustomerId, {
            invoice_settings: {
                default_payment_method: paymentMethodId,
            },
        });

        res.json({ message: 'Payment method added successfully' });
    } catch (error) {
        console.error('Add payment method error:', error);
        res.status(500).json({ error: 'Failed to add payment method' });
    }
});

// Webhook handlers
async function handleSubscriptionCreated(subscription) {
    const user = await User.findOne({
        'subscription.stripeCustomerId': subscription.customer
    });
    
    if (user) {
        user.subscription.stripeSubscriptionId = subscription.id;
        user.subscription.status = subscription.status;
        user.subscription.currentPeriodStart = new Date(subscription.current_period_start * 1000);
        user.subscription.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
        
        // Determine plan from price
        const plan = getPlanFromPrice(subscription.items.data[0].price.id);
        user.subscription.plan = plan;
        
        await user.save();
        console.log(`Subscription created for user ${user._id}`);
    }
}

async function handleSubscriptionUpdated(subscription) {
    const user = await User.findOne({
        'subscription.stripeSubscriptionId': subscription.id
    });
    
    if (user) {
        user.subscription.status = subscription.status;
        user.subscription.currentPeriodStart = new Date(subscription.current_period_start * 1000);
        user.subscription.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
        
        // Update plan if changed
        const plan = getPlanFromPrice(subscription.items.data[0].price.id);
        user.subscription.plan = plan;
        
        await user.save();
        console.log(`Subscription updated for user ${user._id}`);
    }
}

async function handleSubscriptionDeleted(subscription) {
    const user = await User.findOne({
        'subscription.stripeSubscriptionId': subscription.id
    });
    
    if (user) {
        user.subscription.status = 'inactive';
        user.subscription.plan = 'free';
        user.subscription.stripeSubscriptionId = null;
        
        await user.save();
        console.log(`Subscription deleted for user ${user._id}`);
    }
}

async function handlePaymentSucceeded(invoice) {
    const user = await User.findOne({
        'subscription.stripeCustomerId': invoice.customer
    });
    
    if (user) {
        console.log(`Payment succeeded for user ${user._id}, amount: ${invoice.amount_paid}`);
        // You can add additional logic here like sending confirmation emails
    }
}

async function handlePaymentFailed(invoice) {
    const user = await User.findOne({
        'subscription.stripeCustomerId': invoice.customer
    });
    
    if (user) {
        console.log(`Payment failed for user ${user._id}, amount: ${invoice.amount_due}`);
        // You can add logic to handle failed payments, send notifications, etc.
    }
}

function getPlanFromPrice(priceId) {
    const pricePlanMap = {
        'price_pro_monthly': 'pro',
        'price_pro_yearly': 'pro',
        'price_team_monthly': 'team',
        'price_team_yearly': 'team'
    };
    
    return pricePlanMap[priceId] || 'free';
}

module.exports = router;