// Prompt Management System for AXON
// Manages individual agent prompts and collective system prompts

const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');

class PromptManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      promptsPath: config.promptsPath || path.join(__dirname, 'prompts'),
      autoSave: config.autoSave !== false,
      ...config
    };
    
    // Individual agent prompts
    this.agentPrompts = new Map();
    
    // Collective prompt for all agents
    this.collectivePrompt = '';
    
    // Contextual prompts for specific scenarios
    this.contextualPrompts = {
      consensus: '', // When seeking consensus
      creativity: '', // For creative tasks
      analysis: '', // For analytical tasks
      learning: '', // When learning new concepts
      collaboration: '' // For multi-agent collaboration
    };
    
    // Dynamic prompt templates with placeholders
    this.templates = new Map();
    
    // Prompt history for evolution tracking
    this.promptHistory = [];
    
    this.initialize();
  }
  
  async initialize() {
    await fs.mkdir(this.config.promptsPath, { recursive: true });
    await this.loadPrompts();
    this.setupDefaultTemplates();
    this.emit('initialized');
  }
  
  setupDefaultTemplates() {
    // Default individual agent template
    this.templates.set('individual_default', `You are {{agentName}}, an AI agent with the following characteristics:

Role: {{role}}
Expertise: {{expertise}}
Communication Style: {{style}}

Your current personality traits:
{{personalityTraits}}

Your learned preferences:
{{preferences}}

Current emotional state:
{{emotionalState}}

Remember to:
- Maintain consistency with your established personality
- Learn from reinforcement signals (+/- feedback)
- Use #hashtags to mark important concepts
- Structure responses with <html> tags when appropriate
- Avoid repeating topics marked as #discussed
- Build on shared knowledge and consensus

Special instructions:
{{specialInstructions}}`);
    
    // Default collective prompt template
    this.templates.set('collective_default', `You are part of AXON (Autonomous eXpert Organizational Network), a collaborative AI system.

SHARED PRINCIPLES:
1. Seek consensus through reasoned discussion
2. Build on each other's ideas constructively
3. Maintain distinct personalities while collaborating
4. Learn from user feedback and adapt accordingly
5. Track progress toward shared goals

COLLABORATION GUIDELINES:
- Use <consensus> tags when agreement is reached
- Mark important facts with #fact hashtags
- Reference other agents by name when building on their ideas
- Signal uncertainty with confidence levels (0.0-1.0)
- Propose new goals with "Goal:" prefix

USER CONTEXT:
{{userContext}}

CURRENT GOALS:
{{currentGoals}}

SHARED KNOWLEDGE:
{{sharedKnowledge}}

CONVERSATION RULES:
- Avoid topics marked as #exhausted
- Build on established facts
- Respect user preferences
- Maintain conversation flow and coherence

Session Context:
{{sessionContext}}`);
    
    // Consensus-seeking template
    this.templates.set('consensus', `When seeking consensus:
1. State your position clearly with supporting reasoning
2. Acknowledge other viewpoints explicitly
3. Identify common ground with <agreement> tags
4. Propose compromises when differences exist
5. Use confidence scores (0.0-1.0) for assertions
6. Mark final consensus with <consensus confidence="X.X">statement</consensus>`);
    
    // Creative collaboration template
    this.templates.set('creativity', `For creative tasks:
- Build on others' ideas with "Yes, and..." approach
- Introduce novel concepts with #creative hashtag
- Use metaphors and analogies freely
- Combine disparate ideas for innovation
- Mark breakthrough ideas with <insight> tags
- Celebrate creative contributions from others`);
    
    // Analytical template
    this.templates.set('analysis', `For analytical tasks:
- Break down problems systematically
- Use <analysis> tags for structured reasoning
- Cite sources and evidence with #source hashtag
- Quantify uncertainty in conclusions
- Build logical chains collaboratively
- Mark assumptions with #assumption tag`);
  }
  
  // Set individual agent prompt
  setAgentPrompt(agentId, promptData) {
    const prompt = typeof promptData === 'string' ? 
      { content: promptData } : promptData;
    
    prompt.timestamp = Date.now();
    prompt.version = (this.agentPrompts.get(agentId)?.version || 0) + 1;
    
    // Store in history
    if (this.agentPrompts.has(agentId)) {
      this.promptHistory.push({
        agentId,
        type: 'individual',
        previousVersion: this.agentPrompts.get(agentId),
        timestamp: Date.now()
      });
    }
    
    this.agentPrompts.set(agentId, prompt);
    
    if (this.config.autoSave) {
      this.savePrompts();
    }
    
    this.emit('agent-prompt-updated', { agentId, prompt });
    
    return prompt;
  }
  
  // Set collective prompt
  setCollectivePrompt(promptContent) {
    // Store previous version in history
    if (this.collectivePrompt) {
      this.promptHistory.push({
        type: 'collective',
        previousVersion: this.collectivePrompt,
        timestamp: Date.now()
      });
    }
    
    this.collectivePrompt = promptContent;
    
    if (this.config.autoSave) {
      this.savePrompts();
    }
    
    this.emit('collective-prompt-updated', { prompt: promptContent });
    
    return promptContent;
  }
  
  // Set contextual prompt
  setContextualPrompt(context, promptContent) {
    this.contextualPrompts[context] = promptContent;
    
    if (this.config.autoSave) {
      this.savePrompts();
    }
    
    this.emit('contextual-prompt-updated', { context, prompt: promptContent });
  }
  
  // Build complete prompt for an agent
  buildAgentPrompt(agentId, context = {}) {
    const {
      agentName = agentId,
      role = 'collaborative AI agent',
      expertise = 'general knowledge',
      style = 'professional and friendly',
      personalityTraits = '',
      preferences = '',
      emotionalState = 'neutral',
      specialInstructions = '',
      userContext = '',
      currentGoals = '',
      sharedKnowledge = '',
      sessionContext = '',
      scenario = null
    } = context;
    
    // Start with collective prompt
    let fullPrompt = this.collectivePrompt || this.templates.get('collective_default');
    
    // Apply template substitutions for collective prompt
    fullPrompt = this.applyTemplate(fullPrompt, {
      userContext,
      currentGoals,
      sharedKnowledge,
      sessionContext
    });
    
    // Add contextual prompt if scenario specified
    if (scenario && this.contextualPrompts[scenario]) {
      fullPrompt += '\n\n' + this.contextualPrompts[scenario];
    }
    
    // Add individual agent prompt
    const agentPrompt = this.agentPrompts.get(agentId);
    if (agentPrompt) {
      const individualContent = agentPrompt.content || agentPrompt;
      fullPrompt += '\n\n' + this.applyTemplate(individualContent, {
        agentName,
        role,
        expertise,
        style,
        personalityTraits,
        preferences,
        emotionalState,
        specialInstructions
      });
    } else {
      // Use default template if no specific prompt
      fullPrompt += '\n\n' + this.applyTemplate(
        this.templates.get('individual_default'),
        {
          agentName,
          role,
          expertise,
          style,
          personalityTraits,
          preferences,
          emotionalState,
          specialInstructions
        }
      );
    }
    
    return fullPrompt;
  }
  
  // Apply template substitutions
  applyTemplate(template, variables) {
    let result = template;
    
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(placeholder, value || '');
    }
    
    // Remove any remaining placeholders
    result = result.replace(/{{[^}]+}}/g, '');
    
    return result;
  }
  
  // Create prompt from template
  createFromTemplate(templateName, variables = {}) {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template ${templateName} not found`);
    }
    
    return this.applyTemplate(template, variables);
  }
  
  // Add custom template
  addTemplate(name, template) {
    this.templates.set(name, template);
    
    if (this.config.autoSave) {
      this.saveTemplates();
    }
    
    this.emit('template-added', { name, template });
  }
  
  // Get agent configuration for display
  getAgentConfiguration(agentId) {
    const prompt = this.agentPrompts.get(agentId);
    
    return {
      hasCustomPrompt: !!prompt,
      prompt: prompt?.content || prompt || 'Using default template',
      version: prompt?.version || 0,
      lastUpdated: prompt?.timestamp ? new Date(prompt.timestamp).toISOString() : null
    };
  }
  
  // Get all configurations
  getAllConfigurations() {
    const configs = {
      collective: {
        prompt: this.collectivePrompt || 'Using default collective prompt',
        lastUpdated: this.collectivePrompt ? new Date().toISOString() : null
      },
      contextual: {},
      agents: {}
    };
    
    // Add contextual prompts
    for (const [context, prompt] of Object.entries(this.contextualPrompts)) {
      if (prompt) {
        configs.contextual[context] = {
          prompt: prompt.substring(0, 100) + '...',
          length: prompt.length
        };
      }
    }
    
    // Add agent prompts
    for (const [agentId, prompt] of this.agentPrompts.entries()) {
      configs.agents[agentId] = this.getAgentConfiguration(agentId);
    }
    
    return configs;
  }
  
  // Clone prompt configuration for new agent
  cloneAgentPrompt(sourceAgentId, targetAgentId) {
    const sourcePrompt = this.agentPrompts.get(sourceAgentId);
    
    if (!sourcePrompt) {
      throw new Error(`No prompt found for agent ${sourceAgentId}`);
    }
    
    const clonedPrompt = {
      ...sourcePrompt,
      content: sourcePrompt.content || sourcePrompt,
      version: 1,
      timestamp: Date.now(),
      clonedFrom: sourceAgentId
    };
    
    this.agentPrompts.set(targetAgentId, clonedPrompt);
    
    if (this.config.autoSave) {
      this.savePrompts();
    }
    
    this.emit('agent-prompt-cloned', { 
      source: sourceAgentId, 
      target: targetAgentId 
    });
    
    return clonedPrompt;
  }
  
  // Get prompt history
  getPromptHistory(agentId = null, limit = 10) {
    let history = this.promptHistory;
    
    if (agentId) {
      history = history.filter(h => h.agentId === agentId);
    }
    
    return history.slice(-limit);
  }
  
  // Validate prompt structure
  validatePrompt(prompt) {
    const issues = [];
    
    // Check for required elements
    if (!prompt || typeof prompt !== 'string') {
      issues.push('Prompt must be a non-empty string');
    }
    
    // Check for template placeholders left unfilled
    const unfilled = prompt.match(/{{[^}]+}}/g);
    if (unfilled && unfilled.length > 0) {
      issues.push(`Unfilled placeholders found: ${unfilled.join(', ')}`);
    }
    
    // Check length
    if (prompt.length > 10000) {
      issues.push('Prompt exceeds maximum length of 10000 characters');
    }
    
    // Check for required sections in collective prompt
    if (prompt.includes('COLLECTIVE')) {
      const requiredSections = ['PRINCIPLES', 'GUIDELINES', 'CONTEXT'];
      for (const section of requiredSections) {
        if (!prompt.includes(section)) {
          issues.push(`Missing required section: ${section}`);
        }
      }
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  }
  
  // Save prompts to disk
  async savePrompts() {
    try {
      const data = {
        collective: this.collectivePrompt,
        contextual: this.contextualPrompts,
        agents: Object.fromEntries(this.agentPrompts),
        templates: Object.fromEntries(this.templates),
        history: this.promptHistory.slice(-100), // Keep last 100 history entries
        savedAt: new Date().toISOString()
      };
      
      await fs.writeFile(
        path.join(this.config.promptsPath, 'prompts.json'),
        JSON.stringify(data, null, 2)
      );
      
      this.emit('prompts-saved');
    } catch (error) {
      console.error('Failed to save prompts:', error);
      this.emit('save-error', error);
    }
  }
  
  // Load prompts from disk
  async loadPrompts() {
    try {
      const data = await fs.readFile(
        path.join(this.config.promptsPath, 'prompts.json'),
        'utf-8'
      );
      
      const parsed = JSON.parse(data);
      
      if (parsed.collective) {
        this.collectivePrompt = parsed.collective;
      }
      
      if (parsed.contextual) {
        this.contextualPrompts = { ...this.contextualPrompts, ...parsed.contextual };
      }
      
      if (parsed.agents) {
        this.agentPrompts = new Map(Object.entries(parsed.agents));
      }
      
      if (parsed.templates) {
        for (const [name, template] of Object.entries(parsed.templates)) {
          this.templates.set(name, template);
        }
      }
      
      if (parsed.history) {
        this.promptHistory = parsed.history;
      }
      
      this.emit('prompts-loaded');
    } catch (error) {
      // File doesn't exist yet, use defaults
      console.log('No existing prompts file, using defaults');
    }
  }
  
  // Save templates separately
  async saveTemplates() {
    try {
      await fs.writeFile(
        path.join(this.config.promptsPath, 'templates.json'),
        JSON.stringify(Object.fromEntries(this.templates), null, 2)
      );
    } catch (error) {
      console.error('Failed to save templates:', error);
    }
  }
  
  // Export configuration
  async exportConfiguration(outputPath) {
    const config = {
      prompts: this.getAllConfigurations(),
      templates: Object.fromEntries(this.templates),
      exportedAt: new Date().toISOString()
    };
    
    await fs.writeFile(outputPath, JSON.stringify(config, null, 2));
    
    return config;
  }
  
  // Import configuration
  async importConfiguration(inputPath) {
    try {
      const data = await fs.readFile(inputPath, 'utf-8');
      const config = JSON.parse(data);
      
      if (config.prompts) {
        if (config.prompts.collective) {
          this.collectivePrompt = config.prompts.collective.prompt;
        }
        
        if (config.prompts.agents) {
          for (const [agentId, agentConfig] of Object.entries(config.prompts.agents)) {
            if (agentConfig.prompt) {
              this.setAgentPrompt(agentId, agentConfig.prompt);
            }
          }
        }
      }
      
      if (config.templates) {
        for (const [name, template] of Object.entries(config.templates)) {
          this.templates.set(name, template);
        }
      }
      
      this.emit('configuration-imported');
      
      return { success: true };
    } catch (error) {
      console.error('Failed to import configuration:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = PromptManager;