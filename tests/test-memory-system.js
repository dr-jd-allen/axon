// Test script for AXON Three-Layer Memory System
// Demonstrates Model Memory, Conversation Memory, and Meta-Memory

const { EnhancedMemorySystem } = require('./backend/enhanced-memory-system');
const PromptManager = require('./backend/prompt-manager');

async function testMemorySystem() {
  console.log('='.repeat(60));
  console.log('AXON THREE-LAYER MEMORY SYSTEM TEST');
  console.log('='.repeat(60) + '\n');
  
  // Initialize systems
  const memorySystem = new EnhancedMemorySystem({
    persistencePath: './test-memory-store',
    autoSaveInterval: 0 // Manual save for testing
  });
  
  const promptManager = new PromptManager({
    promptsPath: './test-memory-store/prompts',
    autoSave: false
  });
  
  // Wait for initialization
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // ===== TEST 1: Model Memory (Layer 1) =====
  console.log('TEST 1: MODEL MEMORY (Individual Agent Personality)');
  console.log('-'.repeat(50));
  
  // Create two agents with distinct personalities
  const explorer = memorySystem.getModelMemory('agent-1', 'Explorer');
  const synthesizer = memorySystem.getModelMemory('agent-2', 'Synthesizer');
  
  // Add personality traits
  explorer.addTrait('curiosity', 'high', 0.9);
  explorer.addTrait('risk-taking', 'moderate', 0.6);
  explorer.addPreference('exploration', 'deep-dive analysis', 'research context');
  explorer.personality.skills.add('research');
  explorer.personality.skills.add('discovery');
  
  synthesizer.addTrait('analytical', 'very high', 0.95);
  synthesizer.addTrait('creativity', 'moderate', 0.7);
  synthesizer.addPreference('synthesis', 'connecting disparate ideas', 'problem-solving');
  synthesizer.personality.skills.add('pattern-recognition');
  synthesizer.personality.skills.add('integration');
  
  // Apply reinforcement learning
  console.log('\nApplying reinforcement learning...');
  explorer.applyReinforcement('preference:exploration', 0.8, 'research_task');
  explorer.applyReinforcement('action:shallow_analysis', -0.3, 'research_task');
  
  synthesizer.applyReinforcement('preference:synthesis', 0.9, 'integration_task');
  synthesizer.applyReinforcement('action:isolated_thinking', -0.5, 'integration_task');
  
  // Display personality summaries
  console.log('\nExplorer Personality:');
  console.log(explorer.generatePersonalitySummary());
  
  console.log('\nSynthesizer Personality:');
  console.log(synthesizer.generatePersonalitySummary());
  
  // ===== TEST 2: Conversation Memory (Layer 2) =====
  console.log('\n' + '='.repeat(60));
  console.log('TEST 2: CONVERSATION MEMORY (Shared Context)');
  console.log('-'.repeat(50));
  
  const sessionId = 'test-session-001';
  const convMemory = memorySystem.getConversationMemory(sessionId);
  
  // Simulate conversation
  const messages = [
    { agent: 'Explorer', text: 'Let\'s discuss #consciousness and its implications for AI #important' },
    { agent: 'Synthesizer', text: 'Building on that, consciousness relates to #self-awareness and #emergence' },
    { agent: 'Explorer', text: 'Yes, and we should explore the #philosophical aspects too' },
    { agent: 'Synthesizer', text: 'I agree. The connection between #consciousness and #agency is crucial' },
    { agent: 'Explorer', text: 'What about #consciousness in distributed systems? #technical' },
    { agent: 'Synthesizer', text: 'That brings up #collective-intelligence and #swarm-behavior patterns' }
  ];
  
  for (const msg of messages) {
    const result = await memorySystem.processMessage(
      sessionId,
      msg.agent.toLowerCase(),
      msg.agent,
      msg.text,
      { timestamp: Date.now() }
    );
    
    console.log(`\n${msg.agent}: ${msg.text}`);
    console.log(`Topics to avoid: ${result.conversationContext.avoidedTopics.join(', ') || 'none'}`);
  }
  
  // Check if topics should be avoided
  console.log('\n' + '-'.repeat(30));
  console.log('Topic Analysis:');
  console.log(`Should avoid "consciousness": ${memorySystem.shouldAvoidTopic(sessionId, 'consciousness')}`);
  console.log(`Should avoid "quantum": ${memorySystem.shouldAvoidTopic(sessionId, 'quantum')}`);
  
  // Display conversation summary
  console.log('\nConversation Summary:');
  console.log(convMemory.generateSummary());
  
  // ===== TEST 3: Meta-Memory (Layer 3) =====
  console.log('\n' + '='.repeat(60));
  console.log('TEST 3: META-MEMORY (Progress & User Context)');
  console.log('-'.repeat(50));
  
  // Update user profile
  memorySystem.metaMemory.updateUserProfile({
    preferences: { 
      'communication_style': 'technical but accessible',
      'interest_areas': 'AI consciousness, emergent systems'
    },
    goals: 'Understand the relationship between consciousness and AI systems',
    important: 'User is a researcher in cognitive science',
    context: {
      expertise_level: 'advanced',
      project: 'AXON development'
    }
  });
  
  // Add collaboration goals
  const shortTermGoal = memorySystem.metaMemory.addGoal(
    'Explore consciousness in AI systems',
    'shortTerm',
    { priority: 'high' }
  );
  
  const longTermGoal = memorySystem.metaMemory.addGoal(
    'Develop framework for emergent AI consciousness',
    'longTerm',
    { priority: 'medium' }
  );
  
  // Update goal progress
  memorySystem.metaMemory.updateGoalProgress(shortTermGoal.id, 45);
  
  // Add shared understanding
  memorySystem.metaMemory.addSharedFact(
    'Consciousness may emerge from complex information integration',
    0.75,
    ['Explorer analysis', 'Synthesizer confirmation']
  );
  
  memorySystem.metaMemory.addSharedConcept(
    'emergent-consciousness',
    'The hypothesis that consciousness arises from complex interactions in information processing systems',
    ['neural networks', 'integrated information theory', 'global workspace theory']
  );
  
  memorySystem.metaMemory.addDecision(
    'Focus on information integration patterns in next discussion',
    ['Explorer', 'Synthesizer'],
    'Both agents agree this is a promising research direction'
  );
  
  // Display meta-memory summary
  console.log('\nMeta-Memory Summary:');
  console.log(memorySystem.metaMemory.generateSummary());
  
  console.log('\nCurrent Context for Agents:');
  const context = memorySystem.metaMemory.getCurrentContext();
  console.log(JSON.stringify(context, null, 2));
  
  // ===== TEST 4: Prompt Management =====
  console.log('\n' + '='.repeat(60));
  console.log('TEST 4: PROMPT MANAGEMENT');
  console.log('-'.repeat(50));
  
  // Set collective prompt
  promptManager.setCollectivePrompt(`You are part of AXON, exploring consciousness and AI.
Focus on: ${context.user.currentGoals.map(g => g.goal).join(', ')}
User expertise: ${context.user.preferences[0][1]}
Established facts: ${context.knowledge.establishedFacts.join('; ')}`);
  
  // Set individual prompts
  promptManager.setAgentPrompt('agent-1', {
    content: 'You are Explorer, driven by curiosity and deep analysis. #explorer #research',
    metadata: { role: 'researcher' }
  });
  
  promptManager.setAgentPrompt('agent-2', {
    content: 'You are Synthesizer, connecting ideas and finding patterns. #synthesizer #integration',
    metadata: { role: 'integrator' }
  });
  
  // Build complete prompts with context
  const explorerPrompt = promptManager.buildAgentPrompt('agent-1', {
    agentName: 'Explorer',
    personalityTraits: 'Curious, thorough, risk-aware',
    preferences: 'Deep analysis, research-oriented',
    emotionalState: 'engaged',
    userContext: JSON.stringify(context.user.preferences),
    currentGoals: context.collaboration.activeGoals.map(g => g.goal).join('; '),
    sharedKnowledge: context.knowledge.establishedFacts.join('; ')
  });
  
  console.log('\nExplorer Full Prompt:');
  console.log(explorerPrompt.substring(0, 500) + '...\n');
  
  // ===== TEST 5: Integration & Persistence =====
  console.log('='.repeat(60));
  console.log('TEST 5: INTEGRATION & PERSISTENCE');
  console.log('-'.repeat(50));
  
  // Apply reinforcement based on conversation
  console.log('\nApplying conversation-based reinforcement...');
  memorySystem.applyReinforcement('agent-1', 'discuss:consciousness', 0.7, 'conversation');
  memorySystem.applyReinforcement('agent-2', 'synthesize:patterns', 0.8, 'conversation');
  
  // Update effectiveness based on session metrics
  memorySystem.metaMemory.updateEffectiveness({
    consensusRate: 0.8,
    goalProgress: 0.45,
    participationBalance: 0.9
  });
  
  console.log(`\nCollaboration Effectiveness: ${memorySystem.metaMemory.systemState.effectiveness.toFixed(2)}`);
  
  // Generate comprehensive report
  console.log('\n' + '='.repeat(60));
  console.log('COMPREHENSIVE MEMORY REPORT');
  console.log('-'.repeat(50));
  
  const report = memorySystem.generateMemoryReport();
  console.log('\nStatistics:');
  console.log(`- Total Agents: ${report.statistics.totalAgents}`);
  console.log(`- Active Conversations: ${report.statistics.totalConversations}`);
  console.log(`- Goals (Active/Completed): ${report.statistics.totalGoals}/${report.statistics.completedGoals}`);
  console.log(`- Shared Facts: ${report.statistics.sharedFacts}`);
  console.log(`- System Effectiveness: ${(report.statistics.effectiveness * 100).toFixed(1)}%`);
  
  // Save memories
  console.log('\n' + '-'.repeat(30));
  console.log('Saving all memories to disk...');
  await memorySystem.saveMemories();
  await promptManager.savePrompts();
  console.log('✓ Memories saved successfully');
  
  // Test loading
  console.log('\nTesting memory persistence...');
  const newMemorySystem = new EnhancedMemorySystem({
    persistencePath: './test-memory-store'
  });
  
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const loadedExplorer = newMemorySystem.modelMemories.get('agent-1');
  if (loadedExplorer) {
    console.log('✓ Successfully loaded Explorer memory');
    console.log(`  - Traits: ${loadedExplorer.personality.traits.size}`);
    console.log(`  - Q-table entries: ${loadedExplorer.reinforcement.qTable.size}`);
  }
  
  const loadedMeta = newMemorySystem.metaMemory;
  console.log(`✓ Meta-memory loaded with ${loadedMeta.collaborationGoals.shortTerm.length} short-term goals`);
  
  console.log('\n' + '='.repeat(60));
  console.log('TEST COMPLETE');
  console.log('='.repeat(60));
}

// Run the test
testMemorySystem().catch(console.error);