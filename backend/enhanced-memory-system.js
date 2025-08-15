// Enhanced Three-Layer Memory System for AXON
// Implements Model Memory, Conversation Memory, and Progress/Meta-Memory
// With HTML tags, hashtags, and reinforcement learning

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Layer 1: Model Memory - Individual agent personality and preferences
class ModelMemory {
  constructor(agentId, agentName) {
    this.agentId = agentId;
    this.agentName = agentName;
    
    // Personality traits with HTML tags for structure
    this.personality = {
      traits: new Map(), // trait -> {value, confidence, tags}
      preferences: new Map(), // preference -> {value, strength, context}
      beliefs: new Map(), // belief -> {statement, confidence, evidence}
      skills: new Set(), // skill hashtags
      emotions: new Map() // emotion -> intensity (for emergent personality)
    };
    
    // Reinforcement learning components
    this.reinforcement = {
      rewards: [], // {action, reward, context, timestamp}
      punishments: [], // {action, punishment, context, timestamp}
      qTable: new Map(), // state-action -> value
      learningRate: 0.1,
      discountFactor: 0.9,
      explorationRate: 0.1
    };
    
    // Memory tags and markers
    this.memoryTags = {
      important: new Set(), // #important memories
      personal: new Set(), // #personal experiences
      learned: new Set(), // #learned facts
      creative: new Set(), // #creative outputs
      emotional: new Set() // #emotional responses
    };
    
    // HTML-structured memory format
    this.structuredMemory = [];
  }
  
  // Add a personality trait with HTML structure
  addTrait(trait, value, confidence = 0.5) {
    const htmlTag = `<trait name="${trait}" confidence="${confidence}">${value}</trait>`;
    const hashtags = this.extractHashtags(value);
    
    this.personality.traits.set(trait, {
      value,
      confidence,
      htmlTag,
      hashtags,
      timestamp: Date.now()
    });
    
    this.structuredMemory.push({
      type: 'trait',
      content: htmlTag,
      hashtags,
      timestamp: Date.now()
    });
    
    return htmlTag;
  }
  
  // Add preference with reinforcement
  addPreference(preference, value, context = '') {
    const strength = this.personality.preferences.get(preference)?.strength || 0;
    const htmlTag = `<preference context="${context}" strength="${strength}">${preference}: ${value}</preference>`;
    
    this.personality.preferences.set(preference, {
      value,
      strength,
      context,
      htmlTag,
      hashtags: [`#preference_${preference.replace(/\s+/g, '_')}`],
      timestamp: Date.now()
    });
    
    return htmlTag;
  }
  
  // Reinforcement learning update
  applyReinforcement(action, reward, state = 'default') {
    const timestamp = Date.now();
    
    if (reward > 0) {
      this.reinforcement.rewards.push({ action, reward, state, timestamp });
      
      // Update preferences based on positive reinforcement
      if (action.includes('preference:')) {
        const pref = action.split(':')[1];
        const current = this.personality.preferences.get(pref);
        if (current) {
          current.strength = Math.min(1, current.strength + reward * this.reinforcement.learningRate);
        }
      }
    } else {
      this.reinforcement.punishments.push({ 
        action, 
        punishment: Math.abs(reward), 
        state, 
        timestamp 
      });
    }
    
    // Update Q-table for reinforcement learning
    this.updateQValue(state, action, reward);
    
    // Add emotional response based on reinforcement
    this.updateEmotion(reward > 0 ? 'satisfaction' : 'frustration', Math.abs(reward) * 0.5);
  }
  
  // Q-learning update
  updateQValue(state, action, reward) {
    const key = `${state}:${action}`;
    const currentQ = this.reinforcement.qTable.get(key) || 0;
    
    // Find max Q-value for next state
    const nextStateActions = Array.from(this.reinforcement.qTable.keys())
      .filter(k => k.startsWith(state))
      .map(k => this.reinforcement.qTable.get(k) || 0);
    const maxNextQ = Math.max(0, ...nextStateActions);
    
    // Q-learning formula
    const newQ = currentQ + this.reinforcement.learningRate * 
      (reward + this.reinforcement.discountFactor * maxNextQ - currentQ);
    
    this.reinforcement.qTable.set(key, newQ);
  }
  
  // Update emotional state (for emergent personality)
  updateEmotion(emotion, intensity) {
    const current = this.personality.emotions.get(emotion) || 0;
    const updated = Math.max(0, Math.min(1, current + intensity));
    
    this.personality.emotions.set(emotion, updated);
    
    // Decay other emotions slightly
    for (const [emo, val] of this.personality.emotions.entries()) {
      if (emo !== emotion) {
        this.personality.emotions.set(emo, val * 0.95);
      }
    }
  }
  
  // Get action based on current state (epsilon-greedy policy)
  selectAction(state, availableActions) {
    if (Math.random() < this.reinforcement.explorationRate) {
      // Explore: random action
      return availableActions[Math.floor(Math.random() * availableActions.length)];
    }
    
    // Exploit: choose best action based on Q-values
    let bestAction = availableActions[0];
    let bestValue = -Infinity;
    
    for (const action of availableActions) {
      const qValue = this.reinforcement.qTable.get(`${state}:${action}`) || 0;
      if (qValue > bestValue) {
        bestValue = qValue;
        bestAction = action;
      }
    }
    
    return bestAction;
  }
  
  // Extract hashtags from text
  extractHashtags(text) {
    const hashtags = text.match(/#\w+/g) || [];
    return hashtags.map(tag => tag.toLowerCase());
  }
  
  // Generate personality summary with HTML structure
  generatePersonalitySummary() {
    const traits = Array.from(this.personality.traits.entries())
      .map(([trait, data]) => data.htmlTag)
      .join('\n  ');
    
    const preferences = Array.from(this.personality.preferences.entries())
      .filter(([_, data]) => data.strength > 0.3)
      .map(([pref, data]) => data.htmlTag)
      .join('\n  ');
    
    const emotions = Array.from(this.personality.emotions.entries())
      .filter(([_, intensity]) => intensity > 0.1)
      .map(([emotion, intensity]) => 
        `<emotion intensity="${intensity.toFixed(2)}">${emotion}</emotion>`)
      .join('\n  ');
    
    const skills = Array.from(this.personality.skills)
      .map(skill => `#${skill}`)
      .join(' ');
    
    return `<agent id="${this.agentId}" name="${this.agentName}">
  <personality>
    ${traits}
  </personality>
  <preferences>
    ${preferences}
  </preferences>
  <emotional_state>
    ${emotions}
  </emotional_state>
  <skills>${skills}</skills>
  <learning_stats>
    <rewards>${this.reinforcement.rewards.length}</rewards>
    <punishments>${this.reinforcement.punishments.length}</punishments>
    <q_table_size>${this.reinforcement.qTable.size}</q_table_size>
  </learning_stats>
</agent>`;
  }
  
  // Serialize for persistence
  toJSON() {
    return {
      agentId: this.agentId,
      agentName: this.agentName,
      personality: {
        traits: Array.from(this.personality.traits.entries()),
        preferences: Array.from(this.personality.preferences.entries()),
        beliefs: Array.from(this.personality.beliefs.entries()),
        skills: Array.from(this.personality.skills),
        emotions: Array.from(this.personality.emotions.entries())
      },
      reinforcement: {
        rewards: this.reinforcement.rewards.slice(-100), // Keep last 100
        punishments: this.reinforcement.punishments.slice(-100),
        qTable: Array.from(this.reinforcement.qTable.entries()),
        learningRate: this.reinforcement.learningRate
      },
      memoryTags: {
        important: Array.from(this.memoryTags.important),
        personal: Array.from(this.memoryTags.personal),
        learned: Array.from(this.memoryTags.learned)
      },
      structuredMemory: this.structuredMemory.slice(-500) // Keep last 500 memories
    };
  }
  
  // Load from serialized data
  static fromJSON(data) {
    const memory = new ModelMemory(data.agentId, data.agentName);
    
    // Restore personality
    if (data.personality) {
      memory.personality.traits = new Map(data.personality.traits || []);
      memory.personality.preferences = new Map(data.personality.preferences || []);
      memory.personality.beliefs = new Map(data.personality.beliefs || []);
      memory.personality.skills = new Set(data.personality.skills || []);
      memory.personality.emotions = new Map(data.personality.emotions || []);
    }
    
    // Restore reinforcement learning
    if (data.reinforcement) {
      memory.reinforcement.rewards = data.reinforcement.rewards || [];
      memory.reinforcement.punishments = data.reinforcement.punishments || [];
      memory.reinforcement.qTable = new Map(data.reinforcement.qTable || []);
      memory.reinforcement.learningRate = data.reinforcement.learningRate || 0.1;
    }
    
    // Restore memory tags
    if (data.memoryTags) {
      memory.memoryTags.important = new Set(data.memoryTags.important || []);
      memory.memoryTags.personal = new Set(data.memoryTags.personal || []);
      memory.memoryTags.learned = new Set(data.memoryTags.learned || []);
    }
    
    memory.structuredMemory = data.structuredMemory || [];
    
    return memory;
  }
}

// Layer 2: Conversation Memory - Shared across all models
class ConversationMemory {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.participants = new Map(); // agentId -> participation data
    this.topics = new Map(); // topic -> {discussed, consensus, depth}
    this.timeline = []; // Chronological events
    this.summary = '';
    this.keyPoints = [];
    this.avoidedTopics = new Set(); // Topics to avoid repeating
    this.contextWindow = [];
  }
  
  // Add message to conversation
  addMessage(agentId, message, metadata = {}) {
    const timestamp = Date.now();
    const hashtags = this.extractHashtags(message);
    const topics = this.extractTopics(message);
    
    // Update participant data
    if (!this.participants.has(agentId)) {
      this.participants.set(agentId, {
        messageCount: 0,
        topics: new Set(),
        hashtags: new Set(),
        sentiments: []
      });
    }
    
    const participant = this.participants.get(agentId);
    participant.messageCount++;
    topics.forEach(topic => participant.topics.add(topic));
    hashtags.forEach(tag => participant.hashtags.add(tag));
    
    // Update topic tracking
    topics.forEach(topic => {
      if (!this.topics.has(topic)) {
        this.topics.set(topic, {
          discussed: 1,
          consensus: false,
          depth: 1,
          firstMention: timestamp,
          lastMention: timestamp
        });
      } else {
        const topicData = this.topics.get(topic);
        topicData.discussed++;
        topicData.lastMention = timestamp;
        topicData.depth = Math.min(5, topicData.depth + 0.2);
      }
    });
    
    // Add to timeline
    const event = {
      timestamp,
      agentId,
      message,
      hashtags,
      topics,
      metadata,
      htmlStructure: `<message agent="${agentId}" time="${timestamp}">
  <content>${message}</content>
  <topics>${topics.join(', ')}</topics>
  <tags>${hashtags.join(' ')}</tags>
</message>`
    };
    
    this.timeline.push(event);
    this.contextWindow.push(event);
    
    // Maintain context window size
    if (this.contextWindow.length > 20) {
      this.contextWindow.shift();
    }
    
    // Mark heavily discussed topics to avoid repetition
    for (const [topic, data] of this.topics.entries()) {
      if (data.discussed > 5 && data.depth > 3) {
        this.avoidedTopics.add(topic);
      }
    }
    
    return event;
  }
  
  // Check if topic should be avoided
  shouldAvoidTopic(topic) {
    return this.avoidedTopics.has(topic) || 
           (this.topics.get(topic)?.discussed > 3);
  }
  
  // Get conversation context for agents
  getContext(limit = 10) {
    const recentMessages = this.contextWindow.slice(-limit);
    const activeTopics = Array.from(this.topics.entries())
      .filter(([_, data]) => Date.now() - data.lastMention < 300000) // Last 5 minutes
      .map(([topic, data]) => ({
        topic,
        depth: data.depth,
        discussed: data.discussed
      }));
    
    return {
      recentMessages: recentMessages.map(e => ({
        agent: e.agentId,
        message: e.message,
        topics: e.topics
      })),
      activeTopics,
      avoidedTopics: Array.from(this.avoidedTopics),
      participantCount: this.participants.size,
      messageCount: this.timeline.length
    };
  }
  
  // Generate conversation summary
  generateSummary() {
    const topTopics = Array.from(this.topics.entries())
      .sort((a, b) => b[1].discussed - a[1].discussed)
      .slice(0, 5)
      .map(([topic, _]) => topic);
    
    const participantSummary = Array.from(this.participants.entries())
      .map(([agentId, data]) => 
        `${agentId}: ${data.messageCount} messages, topics: ${Array.from(data.topics).slice(0, 3).join(', ')}`
      );
    
    this.summary = `<conversation_summary session="${this.sessionId}">
  <duration>${this.timeline.length > 0 ? Date.now() - this.timeline[0].timestamp : 0}ms</duration>
  <messages>${this.timeline.length}</messages>
  <participants>${participantSummary.join('; ')}</participants>
  <main_topics>${topTopics.join(', ')}</main_topics>
  <avoided_topics>${Array.from(this.avoidedTopics).join(', ')}</avoided_topics>
</conversation_summary>`;
    
    return this.summary;
  }
  
  // Extract topics from message (simple implementation)
  extractTopics(message) {
    const topics = [];
    const keywords = ['about', 'regarding', 'concerning', 'discuss', 'explore', 'think'];
    
    const words = message.toLowerCase().split(/\s+/);
    keywords.forEach(keyword => {
      const idx = words.indexOf(keyword);
      if (idx !== -1 && idx < words.length - 1) {
        topics.push(words[idx + 1].replace(/[^a-z0-9]/g, ''));
      }
    });
    
    // Also extract noun phrases (simplified)
    const nounPhrases = message.match(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g) || [];
    topics.push(...nounPhrases.map(np => np.toLowerCase().replace(/\s+/g, '_')));
    
    return [...new Set(topics)];
  }
  
  extractHashtags(text) {
    return (text.match(/#\w+/g) || []).map(tag => tag.toLowerCase());
  }
}

// Layer 3: Progress/Meta-Memory - Long-term goals and collaboration state
class MetaMemory {
  constructor() {
    this.userProfile = {
      preferences: new Map(),
      goals: [],
      context: {},
      importantInfo: []
    };
    
    this.collaborationGoals = {
      shortTerm: [], // Current session goals
      longTerm: [], // Persistent goals
      completed: [], // Achieved goals
      progress: new Map() // goal -> progress percentage
    };
    
    this.sharedUnderstanding = {
      facts: new Map(), // fact -> {confidence, sources}
      concepts: new Map(), // concept -> {definition, examples}
      decisions: [], // Collective decisions made
      principles: [] // Agreed-upon principles
    };
    
    this.systemState = {
      totalSessions: 0,
      totalMessages: 0,
      activeAgents: new Set(),
      collaborationPatterns: new Map(),
      effectiveness: 0.5
    };
  }
  
  // Update user information
  updateUserProfile(info) {
    if (info.preferences) {
      Object.entries(info.preferences).forEach(([key, value]) => {
        this.userProfile.preferences.set(key, value);
      });
    }
    
    if (info.goals) {
      this.userProfile.goals.push({
        goal: info.goals,
        timestamp: Date.now(),
        status: 'active'
      });
    }
    
    if (info.important) {
      this.userProfile.importantInfo.push({
        info: info.important,
        timestamp: Date.now(),
        hashtags: [`#user_important`]
      });
    }
    
    if (info.context) {
      this.userProfile.context = { ...this.userProfile.context, ...info.context };
    }
  }
  
  // Add collaboration goal
  addGoal(goal, type = 'shortTerm', metadata = {}) {
    const goalObject = {
      id: crypto.randomBytes(8).toString('hex'),
      goal,
      type,
      createdAt: Date.now(),
      status: 'active',
      progress: 0,
      metadata,
      htmlTag: `<goal type="${type}" status="active">${goal}</goal>`
    };
    
    if (type === 'shortTerm') {
      this.collaborationGoals.shortTerm.push(goalObject);
    } else {
      this.collaborationGoals.longTerm.push(goalObject);
    }
    
    this.collaborationGoals.progress.set(goalObject.id, 0);
    
    return goalObject;
  }
  
  // Update goal progress
  updateGoalProgress(goalId, progress) {
    this.collaborationGoals.progress.set(goalId, Math.min(100, progress));
    
    // Check if goal is completed
    if (progress >= 100) {
      const allGoals = [...this.collaborationGoals.shortTerm, ...this.collaborationGoals.longTerm];
      const goal = allGoals.find(g => g.id === goalId);
      
      if (goal) {
        goal.status = 'completed';
        goal.completedAt = Date.now();
        this.collaborationGoals.completed.push(goal);
        
        // Remove from active lists
        this.collaborationGoals.shortTerm = this.collaborationGoals.shortTerm.filter(g => g.id !== goalId);
        this.collaborationGoals.longTerm = this.collaborationGoals.longTerm.filter(g => g.id !== goalId);
      }
    }
  }
  
  // Add shared understanding
  addSharedFact(fact, confidence, sources = []) {
    this.sharedUnderstanding.facts.set(fact, {
      confidence,
      sources,
      timestamp: Date.now(),
      htmlTag: `<fact confidence="${confidence}">${fact}</fact>`
    });
  }
  
  addSharedConcept(concept, definition, examples = []) {
    this.sharedUnderstanding.concepts.set(concept, {
      definition,
      examples,
      timestamp: Date.now(),
      htmlTag: `<concept name="${concept}">
  <definition>${definition}</definition>
  <examples>${examples.join(', ')}</examples>
</concept>`
    });
  }
  
  addDecision(decision, participants, reasoning = '') {
    this.sharedUnderstanding.decisions.push({
      decision,
      participants,
      reasoning,
      timestamp: Date.now(),
      htmlTag: `<decision participants="${participants.join(', ')}">
  <content>${decision}</content>
  <reasoning>${reasoning}</reasoning>
</decision>`
    });
  }
  
  // Update collaboration effectiveness
  updateEffectiveness(sessionMetrics) {
    const { consensusRate, goalProgress, participationBalance } = sessionMetrics;
    
    // Weighted average of metrics
    const newEffectiveness = (
      consensusRate * 0.3 +
      goalProgress * 0.4 +
      participationBalance * 0.3
    );
    
    // Exponential moving average
    this.systemState.effectiveness = 
      this.systemState.effectiveness * 0.7 + newEffectiveness * 0.3;
  }
  
  // Get current context for agents
  getCurrentContext() {
    return {
      user: {
        preferences: Array.from(this.userProfile.preferences.entries()),
        currentGoals: this.userProfile.goals.filter(g => g.status === 'active'),
        importantInfo: this.userProfile.importantInfo.slice(-5)
      },
      collaboration: {
        activeGoals: [
          ...this.collaborationGoals.shortTerm.filter(g => g.status === 'active'),
          ...this.collaborationGoals.longTerm.filter(g => g.status === 'active')
        ],
        recentDecisions: this.sharedUnderstanding.decisions.slice(-3),
        effectiveness: this.systemState.effectiveness
      },
      knowledge: {
        establishedFacts: Array.from(this.sharedUnderstanding.facts.entries())
          .filter(([_, data]) => data.confidence > 0.7)
          .map(([fact, data]) => fact),
        sharedConcepts: Array.from(this.sharedUnderstanding.concepts.keys())
      }
    };
  }
  
  // Generate meta-memory summary
  generateSummary() {
    return `<meta_memory>
  <user_profile>
    <preferences>${Array.from(this.userProfile.preferences.entries()).map(([k, v]) => `${k}:${v}`).join('; ')}</preferences>
    <active_goals>${this.userProfile.goals.filter(g => g.status === 'active').length}</active_goals>
  </user_profile>
  <collaboration_state>
    <short_term_goals>${this.collaborationGoals.shortTerm.length}</short_term_goals>
    <long_term_goals>${this.collaborationGoals.longTerm.length}</long_term_goals>
    <completed_goals>${this.collaborationGoals.completed.length}</completed_goals>
    <effectiveness>${this.systemState.effectiveness.toFixed(2)}</effectiveness>
  </collaboration_state>
  <shared_knowledge>
    <facts>${this.sharedUnderstanding.facts.size}</facts>
    <concepts>${this.sharedUnderstanding.concepts.size}</concepts>
    <decisions>${this.sharedUnderstanding.decisions.length}</decisions>
  </shared_knowledge>
</meta_memory>`;
  }
}

// Main Enhanced Memory System orchestrator
class EnhancedMemorySystem extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      persistencePath: config.persistencePath || path.join(__dirname, 'memory-store'),
      autoSaveInterval: config.autoSaveInterval || 60000, // 1 minute
      mcpServerUrl: config.mcpServerUrl || null,
      useChromaDB: config.useChromaDB || false,
      ...config
    };
    
    // Three layers of memory
    this.modelMemories = new Map(); // agentId -> ModelMemory
    this.conversationMemories = new Map(); // sessionId -> ConversationMemory
    this.metaMemory = new MetaMemory();
    
    // Prompt management
    this.prompts = {
      individual: new Map(), // agentId -> system prompt
      collective: '', // Shared system prompt for all agents
      contextual: new Map() // sessionId -> contextual prompts
    };
    
    this.initialize();
  }
  
  async initialize() {
    // Create persistence directory
    await fs.mkdir(this.config.persistencePath, { recursive: true });
    
    // Load existing memories
    await this.loadMemories();
    
    // Start auto-save
    if (this.config.autoSaveInterval > 0) {
      setInterval(() => this.saveMemories(), this.config.autoSaveInterval);
    }
    
    this.emit('initialized');
  }
  
  // Get or create model memory
  getModelMemory(agentId, agentName) {
    if (!this.modelMemories.has(agentId)) {
      this.modelMemories.set(agentId, new ModelMemory(agentId, agentName));
    }
    return this.modelMemories.get(agentId);
  }
  
  // Get or create conversation memory
  getConversationMemory(sessionId) {
    if (!this.conversationMemories.has(sessionId)) {
      this.conversationMemories.set(sessionId, new ConversationMemory(sessionId));
    }
    return this.conversationMemories.get(sessionId);
  }
  
  // Process agent message with all three memory layers
  async processMessage(sessionId, agentId, agentName, message, metadata = {}) {
    // Layer 1: Update model memory
    const modelMemory = this.getModelMemory(agentId, agentName);
    
    // Extract personality indicators from message
    if (message.includes('#')) {
      const hashtags = message.match(/#\w+/g) || [];
      hashtags.forEach(tag => {
        if (tag.includes('prefer')) {
          modelMemory.addPreference(tag.substring(1), 1, 'expressed');
        } else if (tag.includes('skill')) {
          modelMemory.personality.skills.add(tag.substring(1));
        }
      });
    }
    
    // Layer 2: Update conversation memory
    const convMemory = this.getConversationMemory(sessionId);
    const event = convMemory.addMessage(agentId, message, metadata);
    
    // Layer 3: Check for meta-level updates
    if (message.toLowerCase().includes('goal:')) {
      const goalMatch = message.match(/goal:\s*([^.!?]+)/i);
      if (goalMatch) {
        this.metaMemory.addGoal(goalMatch[1], 'shortTerm', { source: agentId });
      }
    }
    
    // Check for user-related information
    if (message.toLowerCase().includes('user prefers') || message.toLowerCase().includes('user likes')) {
      const preferenceMatch = message.match(/user (?:prefers|likes)\s+([^.!?]+)/i);
      if (preferenceMatch) {
        this.metaMemory.updateUserProfile({
          preferences: { [Date.now()]: preferenceMatch[1] }
        });
      }
    }
    
    // Emit processed message event
    this.emit('message-processed', {
      sessionId,
      agentId,
      modelSummary: modelMemory.generatePersonalitySummary(),
      conversationContext: convMemory.getContext(),
      metaContext: this.metaMemory.getCurrentContext()
    });
    
    return {
      modelMemory,
      conversationContext: convMemory.getContext(),
      metaContext: this.metaMemory.getCurrentContext()
    };
  }
  
  // Apply reinforcement to agent
  applyReinforcement(agentId, action, reward, state = 'default') {
    const modelMemory = this.modelMemories.get(agentId);
    if (modelMemory) {
      modelMemory.applyReinforcement(action, reward, state);
      this.emit('reinforcement-applied', { agentId, action, reward });
    }
  }
  
  // Set prompts
  setIndividualPrompt(agentId, prompt) {
    this.prompts.individual.set(agentId, prompt);
  }
  
  setCollectivePrompt(prompt) {
    this.prompts.collective = prompt;
  }
  
  // Get combined prompt for agent
  getAgentPrompt(agentId, sessionId) {
    const individual = this.prompts.individual.get(agentId) || '';
    const collective = this.prompts.collective || '';
    const contextual = this.prompts.contextual.get(sessionId) || '';
    
    const modelMemory = this.modelMemories.get(agentId);
    const personalityContext = modelMemory ? 
      modelMemory.generatePersonalitySummary() : '';
    
    const metaContext = this.metaMemory.getCurrentContext();
    
    return `${collective}

${individual}

<current_personality>
${personalityContext}
</current_personality>

<user_context>
Preferences: ${metaContext.user.preferences.map(([k, v]) => `${k}: ${v}`).join(', ')}
Current Goals: ${metaContext.user.currentGoals.map(g => g.goal).join('; ')}
</user_context>

<collaboration_context>
Active Goals: ${metaContext.collaboration.activeGoals.map(g => g.goal).join('; ')}
Effectiveness: ${metaContext.collaboration.effectiveness.toFixed(2)}
</collaboration_context>

${contextual}`;
  }
  
  // Check if topic should be avoided
  shouldAvoidTopic(sessionId, topic) {
    const convMemory = this.conversationMemories.get(sessionId);
    return convMemory ? convMemory.shouldAvoidTopic(topic) : false;
  }
  
  // Save memories to disk
  async saveMemories() {
    try {
      // Save model memories
      const modelData = {};
      for (const [agentId, memory] of this.modelMemories.entries()) {
        modelData[agentId] = memory.toJSON();
      }
      await fs.writeFile(
        path.join(this.config.persistencePath, 'model-memories.json'),
        JSON.stringify(modelData, null, 2)
      );
      
      // Save conversation memories (keep last 10 sessions)
      const convData = {};
      const sortedConversations = Array.from(this.conversationMemories.entries())
        .sort((a, b) => b[1].timeline[0]?.timestamp - a[1].timeline[0]?.timestamp)
        .slice(0, 10);
      
      for (const [sessionId, memory] of sortedConversations) {
        convData[sessionId] = {
          participants: Array.from(memory.participants.entries()),
          topics: Array.from(memory.topics.entries()),
          summary: memory.generateSummary(),
          keyPoints: memory.keyPoints,
          avoidedTopics: Array.from(memory.avoidedTopics)
        };
      }
      await fs.writeFile(
        path.join(this.config.persistencePath, 'conversation-memories.json'),
        JSON.stringify(convData, null, 2)
      );
      
      // Save meta memory
      await fs.writeFile(
        path.join(this.config.persistencePath, 'meta-memory.json'),
        JSON.stringify({
          userProfile: {
            preferences: Array.from(this.metaMemory.userProfile.preferences.entries()),
            goals: this.metaMemory.userProfile.goals,
            context: this.metaMemory.userProfile.context,
            importantInfo: this.metaMemory.userProfile.importantInfo
          },
          collaborationGoals: this.metaMemory.collaborationGoals,
          sharedUnderstanding: {
            facts: Array.from(this.metaMemory.sharedUnderstanding.facts.entries()),
            concepts: Array.from(this.metaMemory.sharedUnderstanding.concepts.entries()),
            decisions: this.metaMemory.sharedUnderstanding.decisions,
            principles: this.metaMemory.sharedUnderstanding.principles
          },
          systemState: this.metaMemory.systemState
        }, null, 2)
      );
      
      // Save prompts
      await fs.writeFile(
        path.join(this.config.persistencePath, 'prompts.json'),
        JSON.stringify({
          individual: Array.from(this.prompts.individual.entries()),
          collective: this.prompts.collective,
          contextual: Array.from(this.prompts.contextual.entries())
        }, null, 2)
      );
      
      this.emit('memories-saved');
    } catch (error) {
      console.error('Failed to save memories:', error);
      this.emit('save-error', error);
    }
  }
  
  // Load memories from disk
  async loadMemories() {
    try {
      // Load model memories
      try {
        const modelData = await fs.readFile(
          path.join(this.config.persistencePath, 'model-memories.json'),
          'utf-8'
        );
        const parsed = JSON.parse(modelData);
        for (const [agentId, data] of Object.entries(parsed)) {
          this.modelMemories.set(agentId, ModelMemory.fromJSON(data));
        }
      } catch (err) {
        console.log('No existing model memories found');
      }
      
      // Load meta memory
      try {
        const metaData = await fs.readFile(
          path.join(this.config.persistencePath, 'meta-memory.json'),
          'utf-8'
        );
        const parsed = JSON.parse(metaData);
        
        if (parsed.userProfile) {
          this.metaMemory.userProfile.preferences = new Map(parsed.userProfile.preferences || []);
          this.metaMemory.userProfile.goals = parsed.userProfile.goals || [];
          this.metaMemory.userProfile.context = parsed.userProfile.context || {};
          this.metaMemory.userProfile.importantInfo = parsed.userProfile.importantInfo || [];
        }
        
        if (parsed.collaborationGoals) {
          this.metaMemory.collaborationGoals = parsed.collaborationGoals;
          this.metaMemory.collaborationGoals.progress = new Map(
            Object.entries(parsed.collaborationGoals.progress || {})
          );
        }
        
        if (parsed.sharedUnderstanding) {
          this.metaMemory.sharedUnderstanding.facts = new Map(parsed.sharedUnderstanding.facts || []);
          this.metaMemory.sharedUnderstanding.concepts = new Map(parsed.sharedUnderstanding.concepts || []);
          this.metaMemory.sharedUnderstanding.decisions = parsed.sharedUnderstanding.decisions || [];
          this.metaMemory.sharedUnderstanding.principles = parsed.sharedUnderstanding.principles || [];
        }
        
        if (parsed.systemState) {
          this.metaMemory.systemState = parsed.systemState;
          this.metaMemory.systemState.activeAgents = new Set(parsed.systemState.activeAgents || []);
        }
      } catch (err) {
        console.log('No existing meta memory found');
      }
      
      // Load prompts
      try {
        const promptData = await fs.readFile(
          path.join(this.config.persistencePath, 'prompts.json'),
          'utf-8'
        );
        const parsed = JSON.parse(promptData);
        this.prompts.individual = new Map(parsed.individual || []);
        this.prompts.collective = parsed.collective || '';
        this.prompts.contextual = new Map(parsed.contextual || []);
      } catch (err) {
        console.log('No existing prompts found');
      }
      
      this.emit('memories-loaded');
    } catch (error) {
      console.error('Failed to load memories:', error);
      this.emit('load-error', error);
    }
  }
  
  // Generate comprehensive memory report
  generateMemoryReport() {
    const report = {
      modelMemories: {},
      activeConversations: {},
      metaMemory: this.metaMemory.generateSummary(),
      statistics: {
        totalAgents: this.modelMemories.size,
        totalConversations: this.conversationMemories.size,
        totalGoals: this.metaMemory.collaborationGoals.shortTerm.length + 
                   this.metaMemory.collaborationGoals.longTerm.length,
        completedGoals: this.metaMemory.collaborationGoals.completed.length,
        sharedFacts: this.metaMemory.sharedUnderstanding.facts.size,
        effectiveness: this.metaMemory.systemState.effectiveness
      }
    };
    
    // Add model memory summaries
    for (const [agentId, memory] of this.modelMemories.entries()) {
      report.modelMemories[agentId] = {
        summary: memory.generatePersonalitySummary(),
        rewardCount: memory.reinforcement.rewards.length,
        qTableSize: memory.reinforcement.qTable.size,
        topEmotions: Array.from(memory.personality.emotions.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
      };
    }
    
    // Add active conversation summaries
    for (const [sessionId, memory] of this.conversationMemories.entries()) {
      if (memory.timeline.length > 0 && 
          Date.now() - memory.timeline[memory.timeline.length - 1].timestamp < 3600000) {
        report.activeConversations[sessionId] = {
          summary: memory.generateSummary(),
          messageCount: memory.timeline.length,
          participantCount: memory.participants.size,
          topTopics: Array.from(memory.topics.entries())
            .sort((a, b) => b[1].discussed - a[1].discussed)
            .slice(0, 5)
            .map(([topic, _]) => topic)
        };
      }
    }
    
    return report;
  }
}

module.exports = {
  EnhancedMemorySystem,
  ModelMemory,
  ConversationMemory,
  MetaMemory
};