const { GoogleGenerativeAI } = require('@google/generative-ai');
const User = require('../models/User');
const Project = require('../models/Project');

class AgentService {
    constructor(io) {
        this.io = io;
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.activeAgents = new Map(); // Track active AI agents
        this.agentTypes = {
            CODING_ASSISTANT: 'coding_assistant',
            CODE_REVIEWER: 'code_reviewer',
            DEBUG_AGENT: 'debug_agent',
            REFACTOR_AGENT: 'refactor_agent',
            TEST_GENERATOR: 'test_generator',
            DOCUMENTATION_AGENT: 'documentation_agent',
            SECURITY_SCANNER: 'security_scanner'
        };
    }

    // Handle agent requests from Socket.IO
    async handleAgentRequest(socket, data) {
        try {
            const { agentType, action, projectId, ...params } = data;
            const userId = socket.userId;

            // Check if user can use AI
            const user = await User.findById(userId);
            if (!user.canUseAI()) {
                socket.emit('agent-error', { 
                    error: 'AI usage limit exceeded for your plan',
                    upgradeUrl: '/pricing'
                });
                return;
            }

            switch (agentType) {
                case this.agentTypes.CODING_ASSISTANT:
                    await this.handleCodingAssistant(socket, userId, projectId, action, params);
                    break;
                case this.agentTypes.CODE_REVIEWER:
                    await this.handleCodeReviewer(socket, userId, projectId, action, params);
                    break;
                case this.agentTypes.DEBUG_AGENT:
                    await this.handleDebugAgent(socket, userId, projectId, action, params);
                    break;
                case this.agentTypes.REFACTOR_AGENT:
                    await this.handleRefactorAgent(socket, userId, projectId, action, params);
                    break;
                case this.agentTypes.TEST_GENERATOR:
                    await this.handleTestGenerator(socket, userId, projectId, action, params);
                    break;
                case this.agentTypes.DOCUMENTATION_AGENT:
                    await this.handleDocumentationAgent(socket, userId, projectId, action, params);
                    break;
                case this.agentTypes.SECURITY_SCANNER:
                    await this.handleSecurityScanner(socket, userId, projectId, action, params);
                    break;
                default:
                    socket.emit('agent-error', { error: 'Unknown agent type' });
            }

            // Increment AI usage
            await user.incrementAIUsage();

        } catch (error) {
            console.error('Agent request error:', error);
            socket.emit('agent-error', { error: error.message });
        }
    }

    // Coding Assistant Agent
    async handleCodingAssistant(socket, userId, projectId, action, params) {
        const project = await Project.findById(projectId);
        
        switch (action) {
            case 'code_completion':
                await this.handleCodeCompletion(socket, project, params);
                break;
            case 'explain_code':
                await this.handleExplainCode(socket, project, params);
                break;
            case 'suggest_improvements':
                await this.handleSuggestImprovements(socket, project, params);
                break;
            case 'generate_function':
                await this.handleGenerateFunction(socket, project, params);
                break;
            case 'fix_syntax_errors':
                await this.handleFixSyntaxErrors(socket, project, params);
                break;
            default:
                socket.emit('agent-error', { error: 'Unknown coding assistant action' });
        }
    }

    // Code completion
    async handleCodeCompletion(socket, project, { filePath, position, context }) {
        try {
            const file = project.files.find(f => f.path === filePath);
            if (!file) {
                throw new Error('File not found');
            }

            const prompt = this.buildCodeCompletionPrompt(file, position, context);
            const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            
            const result = await model.generateContent(prompt);
            const response = result.response.text();

            socket.emit('code-completion', {
                suggestions: this.parseCodeCompletions(response),
                position,
                context
            });

        } catch (error) {
            socket.emit('agent-error', { error: `Code completion failed: ${error.message}` });
        }
    }

    // Explain code
    async handleExplainCode(socket, project, { filePath, selectedCode, lineStart, lineEnd }) {
        try {
            const file = project.files.find(f => f.path === filePath);
            if (!file) {
                throw new Error('File not found');
            }

            const codeToExplain = selectedCode || this.extractCodeLines(file.content, lineStart, lineEnd);
            const prompt = `Explain this ${file.language} code in detail:\n\n\`\`\`${file.language}\n${codeToExplain}\n\`\`\`\n\nProvide a clear, comprehensive explanation of what this code does, how it works, and any important concepts or patterns used.`;

            const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            const result = await model.generateContent(prompt);
            const explanation = result.response.text();

            socket.emit('code-explanation', {
                explanation,
                code: codeToExplain,
                language: file.language,
                filePath
            });

        } catch (error) {
            socket.emit('agent-error', { error: `Code explanation failed: ${error.message}` });
        }
    }

    // Code Review Agent
    async handleCodeReviewer(socket, userId, projectId, action, params) {
        const project = await Project.findById(projectId);
        
        switch (action) {
            case 'review_file':
                await this.handleReviewFile(socket, project, params);
                break;
            case 'review_changes':
                await this.handleReviewChanges(socket, project, params);
                break;
            case 'suggest_best_practices':
                await this.handleSuggestBestPractices(socket, project, params);
                break;
            case 'check_code_quality':
                await this.handleCheckCodeQuality(socket, project, params);
                break;
            default:
                socket.emit('agent-error', { error: 'Unknown code reviewer action' });
        }
    }

    // Review entire file
    async handleReviewFile(socket, project, { filePath }) {
        try {
            const file = project.files.find(f => f.path === filePath);
            if (!file) {
                throw new Error('File not found');
            }

            const prompt = `Perform a comprehensive code review of this ${file.language} file. Analyze for:
1. Code quality and best practices
2. Performance issues
3. Security vulnerabilities
4. Maintainability concerns
5. Potential bugs
6. Code style and formatting

File: ${file.name}
\`\`\`${file.language}
${file.content}
\`\`\`

Provide specific feedback with line numbers and actionable suggestions for improvement.`;

            const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            const result = await model.generateContent(prompt);
            const review = result.response.text();

            socket.emit('code-review', {
                filePath,
                review: this.parseCodeReview(review),
                timestamp: new Date()
            });

        } catch (error) {
            socket.emit('agent-error', { error: `Code review failed: ${error.message}` });
        }
    }

    // Debug Agent
    async handleDebugAgent(socket, userId, projectId, action, params) {
        const project = await Project.findById(projectId);
        
        switch (action) {
            case 'analyze_error':
                await this.handleAnalyzeError(socket, project, params);
                break;
            case 'suggest_fixes':
                await this.handleSuggestFixes(socket, project, params);
                break;
            case 'trace_execution':
                await this.handleTraceExecution(socket, project, params);
                break;
            default:
                socket.emit('agent-error', { error: 'Unknown debug agent action' });
        }
    }

    // Analyze error
    async handleAnalyzeError(socket, project, { errorMessage, filePath, lineNumber, stackTrace }) {
        try {
            const file = project.files.find(f => f.path === filePath);
            const contextCode = file ? this.getCodeContext(file.content, lineNumber, 10) : '';

            const prompt = `Analyze this error and provide debugging assistance:

Error: ${errorMessage}
File: ${filePath}
Line: ${lineNumber}
Stack Trace:
${stackTrace}

Code Context:
\`\`\`${file?.language || 'text'}
${contextCode}
\`\`\`

Please provide:
1. Explanation of what caused the error
2. Specific steps to fix it
3. Prevention strategies
4. Alternative approaches if applicable`;

            const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            const result = await model.generateContent(prompt);
            const analysis = result.response.text();

            socket.emit('error-analysis', {
                analysis,
                errorMessage,
                filePath,
                lineNumber,
                suggestions: this.parseDebugSuggestions(analysis)
            });

        } catch (error) {
            socket.emit('agent-error', { error: `Error analysis failed: ${error.message}` });
        }
    }

    // Test Generator Agent
    async handleTestGenerator(socket, userId, projectId, action, params) {
        const project = await Project.findById(projectId);
        
        switch (action) {
            case 'generate_unit_tests':
                await this.handleGenerateUnitTests(socket, project, params);
                break;
            case 'generate_integration_tests':
                await this.handleGenerateIntegrationTests(socket, project, params);
                break;
            case 'suggest_test_cases':
                await this.handleSuggestTestCases(socket, project, params);
                break;
            default:
                socket.emit('agent-error', { error: 'Unknown test generator action' });
        }
    }

    // Generate unit tests
    async handleGenerateUnitTests(socket, project, { filePath, functionName, testFramework = 'jest' }) {
        try {
            const file = project.files.find(f => f.path === filePath);
            if (!file) {
                throw new Error('File not found');
            }

            const functionCode = functionName ? 
                this.extractFunction(file.content, functionName) : 
                file.content;

            const prompt = `Generate comprehensive unit tests for this ${file.language} code using ${testFramework}:

\`\`\`${file.language}
${functionCode}
\`\`\`

Include:
1. Happy path tests
2. Edge cases
3. Error handling
4. Boundary conditions
5. Mock dependencies if needed

Generate complete, runnable test code.`;

            const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            const result = await model.generateContent(prompt);
            const tests = result.response.text();

            socket.emit('tests-generated', {
                testCode: this.extractCodeFromResponse(tests),
                framework: testFramework,
                filePath,
                functionName
            });

        } catch (error) {
            socket.emit('agent-error', { error: `Test generation failed: ${error.message}` });
        }
    }

    // Documentation Agent
    async handleDocumentationAgent(socket, userId, projectId, action, params) {
        const project = await Project.findById(projectId);
        
        switch (action) {
            case 'generate_docs':
                await this.handleGenerateDocs(socket, project, params);
                break;
            case 'generate_readme':
                await this.handleGenerateReadme(socket, project, params);
                break;
            case 'add_comments':
                await this.handleAddComments(socket, project, params);
                break;
            default:
                socket.emit('agent-error', { error: 'Unknown documentation agent action' });
        }
    }

    // Generate documentation
    async handleGenerateDocs(socket, project, { filePath, format = 'markdown' }) {
        try {
            const file = project.files.find(f => f.path === filePath);
            if (!file) {
                throw new Error('File not found');
            }

            const prompt = `Generate comprehensive ${format} documentation for this ${file.language} code:

\`\`\`${file.language}
${file.content}
\`\`\`

Include:
1. Overview and purpose
2. API documentation (functions, classes, methods)
3. Parameters and return values
4. Usage examples
5. Dependencies
6. Configuration options if applicable

Format the output as clean ${format}.`;

            const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            const result = await model.generateContent(prompt);
            const documentation = result.response.text();

            socket.emit('documentation-generated', {
                documentation,
                format,
                filePath,
                fileName: file.name
            });

        } catch (error) {
            socket.emit('agent-error', { error: `Documentation generation failed: ${error.message}` });
        }
    }

    // Security Scanner Agent
    async handleSecurityScanner(socket, userId, projectId, action, params) {
        const project = await Project.findById(projectId);
        
        switch (action) {
            case 'scan_vulnerabilities':
                await this.handleScanVulnerabilities(socket, project, params);
                break;
            case 'check_dependencies':
                await this.handleCheckDependencies(socket, project, params);
                break;
            case 'analyze_secrets':
                await this.handleAnalyzeSecrets(socket, project, params);
                break;
            default:
                socket.emit('agent-error', { error: 'Unknown security scanner action' });
        }
    }

    // Scan for security vulnerabilities
    async handleScanVulnerabilities(socket, project, { filePath }) {
        try {
            const filesToScan = filePath ? 
                [project.files.find(f => f.path === filePath)] : 
                project.files.filter(f => !f.isDirectory);

            const vulnerabilities = [];

            for (const file of filesToScan) {
                if (!file || !file.content) continue;

                const prompt = `Analyze this ${file.language} code for security vulnerabilities:

\`\`\`${file.language}
${file.content}
\`\`\`

Look for:
1. SQL injection vulnerabilities
2. XSS vulnerabilities
3. CSRF issues
4. Authentication/authorization flaws
5. Input validation issues
6. Cryptographic weaknesses
7. Insecure direct object references
8. Security misconfigurations

Provide specific line numbers and severity levels (Critical, High, Medium, Low).`;

                const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
                const result = await model.generateContent(prompt);
                const analysis = result.response.text();

                const fileVulnerabilities = this.parseSecurityAnalysis(analysis, file.path);
                vulnerabilities.push(...fileVulnerabilities);
            }

            socket.emit('security-scan-complete', {
                vulnerabilities,
                scannedFiles: filesToScan.length,
                timestamp: new Date()
            });

        } catch (error) {
            socket.emit('agent-error', { error: `Security scan failed: ${error.message}` });
        }
    }

    // Utility methods
    buildCodeCompletionPrompt(file, position, context) {
        const beforeCursor = file.content.substring(0, position);
        const afterCursor = file.content.substring(position);
        
        return `Complete this ${file.language} code. Provide 3-5 relevant completions:

Context before cursor:
\`\`\`${file.language}
${beforeCursor.split('\n').slice(-10).join('\n')}
\`\`\`

Context after cursor:
\`\`\`${file.language}
${afterCursor.split('\n').slice(0, 5).join('\n')}
\`\`\`

Additional context: ${context}

Provide completions as a JSON array of strings. Focus on the most likely and useful completions.`;
    }

    parseCodeCompletions(response) {
        try {
            // Try to extract JSON array from response
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            
            // Fallback: split by lines and clean up
            return response.split('\n')
                .filter(line => line.trim())
                .slice(0, 5)
                .map(line => line.replace(/^[-*]\s*/, '').trim());
        } catch (error) {
            return [response.trim()];
        }
    }

    parseCodeReview(review) {
        const sections = {
            issues: [],
            suggestions: [],
            positives: []
        };

        // Parse review text and categorize feedback
        const lines = review.split('\n');
        let currentSection = 'general';
        
        for (const line of lines) {
            if (line.toLowerCase().includes('issue') || line.toLowerCase().includes('problem')) {
                sections.issues.push(line.trim());
            } else if (line.toLowerCase().includes('suggest') || line.toLowerCase().includes('improve')) {
                sections.suggestions.push(line.trim());
            } else if (line.toLowerCase().includes('good') || line.toLowerCase().includes('well')) {
                sections.positives.push(line.trim());
            }
        }

        return {
            summary: review,
            ...sections,
            timestamp: new Date()
        };
    }

    parseDebugSuggestions(analysis) {
        const suggestions = [];
        const lines = analysis.split('\n');
        
        for (const line of lines) {
            if (line.match(/^\d+\./) || line.includes('fix') || line.includes('solution')) {
                suggestions.push({
                    type: 'fix',
                    description: line.trim(),
                    priority: this.determinePriority(line)
                });
            }
        }

        return suggestions;
    }

    parseSecurityAnalysis(analysis, filePath) {
        const vulnerabilities = [];
        const lines = analysis.split('\n');
        
        for (const line of lines) {
            const severityMatch = line.match(/(Critical|High|Medium|Low)/i);
            const lineMatch = line.match(/line\s+(\d+)/i);
            
            if (severityMatch) {
                vulnerabilities.push({
                    file: filePath,
                    line: lineMatch ? parseInt(lineMatch[1]) : null,
                    severity: severityMatch[1].toLowerCase(),
                    description: line.trim(),
                    type: this.categorizeVulnerability(line)
                });
            }
        }

        return vulnerabilities;
    }

    extractCodeFromResponse(response) {
        const codeBlockMatch = response.match(/```[\w]*\n([\s\S]*?)\n```/);
        return codeBlockMatch ? codeBlockMatch[1] : response;
    }

    extractCodeLines(content, start, end) {
        const lines = content.split('\n');
        return lines.slice(start - 1, end).join('\n');
    }

    getCodeContext(content, lineNumber, contextLines = 5) {
        const lines = content.split('\n');
        const start = Math.max(0, lineNumber - contextLines - 1);
        const end = Math.min(lines.length, lineNumber + contextLines);
        return lines.slice(start, end).join('\n');
    }

    extractFunction(content, functionName) {
        // Simple function extraction - could be improved with AST parsing
        const lines = content.split('\n');
        const functionPattern = new RegExp(`(function\\s+${functionName}|${functionName}\\s*[:=]|def\\s+${functionName})`, 'i');
        
        let start = -1;
        let end = -1;
        let braceCount = 0;
        
        for (let i = 0; i < lines.length; i++) {
            if (start === -1 && functionPattern.test(lines[i])) {
                start = i;
            }
            
            if (start !== -1) {
                const line = lines[i];
                braceCount += (line.match(/\{/g) || []).length;
                braceCount -= (line.match(/\}/g) || []).length;
                
                if (braceCount === 0 && i > start) {
                    end = i;
                    break;
                }
            }
        }
        
        return start !== -1 && end !== -1 ? 
            lines.slice(start, end + 1).join('\n') : 
            content;
    }

    determinePriority(text) {
        if (text.toLowerCase().includes('critical') || text.toLowerCase().includes('urgent')) {
            return 'high';
        } else if (text.toLowerCase().includes('important') || text.toLowerCase().includes('should')) {
            return 'medium';
        }
        return 'low';
    }

    categorizeVulnerability(description) {
        const desc = description.toLowerCase();
        if (desc.includes('sql') || desc.includes('injection')) return 'injection';
        if (desc.includes('xss') || desc.includes('script')) return 'xss';
        if (desc.includes('auth') || desc.includes('permission')) return 'authentication';
        if (desc.includes('crypto') || desc.includes('encrypt')) return 'cryptography';
        if (desc.includes('input') || desc.includes('validation')) return 'input_validation';
        return 'general';
    }

    // Agent management
    createAgent(userId, projectId, agentType, config) {
        const agentId = `${userId}_${projectId}_${agentType}_${Date.now()}`;
        const agent = {
            id: agentId,
            userId,
            projectId,
            type: agentType,
            config,
            status: 'active',
            createdAt: new Date(),
            lastActivity: new Date()
        };
        
        this.activeAgents.set(agentId, agent);
        return agent;
    }

    getActiveAgents(userId, projectId) {
        return Array.from(this.activeAgents.values()).filter(
            agent => agent.userId === userId && agent.projectId === projectId
        );
    }

    stopAgent(agentId) {
        const agent = this.activeAgents.get(agentId);
        if (agent) {
            agent.status = 'stopped';
            this.activeAgents.delete(agentId);
        }
        return agent;
    }
}

module.exports = AgentService;