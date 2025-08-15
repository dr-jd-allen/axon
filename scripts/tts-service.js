// AXON Text-to-Speech Service
// Supports multiple TTS providers with speech queuing and voice management

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class TTSService extends EventEmitter {
    constructor(config = {}) {
        super();
        this.enabled = config.enabled !== false; // Default to enabled
        this.provider = config.provider || 'webspeech'; // webspeech, elevenlabs, azure, aws
        this.speechQueue = [];
        this.isPlaying = false;
        this.currentSpeaker = null;
        
        // Default TTS settings
        this.defaultSettings = {
            rate: config.rate || 1.0,
            pitch: config.pitch || 1.0,
            volume: config.volume || 1.0,
            voice: config.voice || null
        };
        
        // Agent-specific voice configurations
        this.agentVoices = config.agentVoices || {
            'Explorer': {
                voice: 'male',
                rate: 0.9,
                pitch: 1.0,
                volume: 0.8
            },
            'Synthesizer': {
                voice: 'female',
                rate: 1.0,
                pitch: 1.1,
                volume: 0.8
            }
        };
        
        // Cloud TTS API keys
        this.apiKeys = {
            elevenlabs: config.elevenLabsApiKey || process.env.ELEVENLABS_API_KEY,
            speechify: config.speechifyApiKey || process.env.SPEECHIFY_API_KEY,
            azure: config.azureApiKey || process.env.AZURE_SPEECH_KEY,
            aws: config.awsAccessKey || process.env.AWS_ACCESS_KEY_ID
        };
        
        // Available voices per provider
        this.availableVoices = {
            webspeech: {
                male: { name: 'Microsoft David - English (United States)', lang: 'en-US' },
                female: { name: 'Microsoft Zira - English (United States)', lang: 'en-US' }
            },
            elevenlabs: {
                male: { voiceId: 'pNInz6obpgDQGcFmaJgB', name: 'Adam' },
                female: { voiceId: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah' },
                rachel: { voiceId: 'rachel', name: 'Rachel' },
                domi: { voiceId: 'domi', name: 'Domi' },
                bella: { voiceId: 'bella', name: 'Bella' },
                antoni: { voiceId: 'antoni', name: 'Antoni' },
                josh: { voiceId: 'josh', name: 'Josh' },
                arnold: { voiceId: 'arnold', name: 'Arnold' }
            },
            speechify: {
                male: { voiceId: 'john', name: 'John' },
                female: { voiceId: 'sarah', name: 'Sarah' },
                'mr-beast': { voiceId: 'mr-beast', name: 'Mr. Beast' },
                'snoop-dogg': { voiceId: 'snoop-dogg', name: 'Snoop Dogg' },
                'gwyneth-paltrow': { voiceId: 'gwyneth-paltrow', name: 'Gwyneth Paltrow' }
            },
            azure: {
                male: { voice: 'en-US-DavisNeural', name: 'Davis' },
                female: { voice: 'en-US-JennyNeural', name: 'Jenny' }
            }
        };
        
        this.init();
    }
    
    async init() {
        console.log(`[TTS] Initializing TTS Service with provider: ${this.provider}`);
        
        // Validate provider-specific requirements
        if (this.provider !== 'webspeech' && !this.apiKeys[this.provider]) {
            console.warn(`[TTS] No API key found for ${this.provider}, falling back to Web Speech API`);
            this.provider = 'webspeech';
        }
        
        this.emit('initialized', { provider: this.provider, enabled: this.enabled });
    }
    
    // Queue speech for an agent
    async speak(text, agentName, options = {}) {
        if (!this.enabled) {
            return { success: false, reason: 'TTS disabled' };
        }
        
        const speechItem = {
            id: this.generateId(),
            text: this.sanitizeText(text),
            agent: agentName,
            timestamp: new Date(),
            settings: this.getAgentSettings(agentName, options),
            status: 'queued'
        };
        
        this.speechQueue.push(speechItem);
        this.emit('speech-queued', speechItem);
        
        // Process queue if not currently playing
        if (!this.isPlaying) {
            this.processQueue();
        }
        
        return { success: true, id: speechItem.id };
    }
    
    // Process the speech queue
    async processQueue() {
        if (this.isPlaying || this.speechQueue.length === 0) {
            return;
        }
        
        this.isPlaying = true;
        
        while (this.speechQueue.length > 0) {
            const speechItem = this.speechQueue.shift();
            speechItem.status = 'playing';
            this.currentSpeaker = speechItem.agent;
            
            this.emit('speech-start', speechItem);
            
            try {
                await this.performSpeech(speechItem);
                speechItem.status = 'completed';
                this.emit('speech-end', speechItem);
            } catch (error) {
                speechItem.status = 'error';
                speechItem.error = error.message;
                this.emit('speech-error', { ...speechItem, error: error.message });
                console.error(`[TTS] Speech error:`, error);
            }
            
            // Small delay between speeches
            await this.delay(200);
        }
        
        this.isPlaying = false;
        this.currentSpeaker = null;
        this.emit('queue-empty');
    }
    
    // Perform actual speech synthesis
    async performSpeech(speechItem) {
        switch (this.provider) {
            case 'webspeech':
                return await this.speakWithWebSpeech(speechItem);
            case 'elevenlabs':
                return await this.speakWithElevenLabs(speechItem);
            case 'azure':
                return await this.speakWithAzure(speechItem);
            case 'aws':
                return await this.speakWithAWS(speechItem);
            default:
                throw new Error(`Unsupported TTS provider: ${this.provider}`);
        }
    }
    
    // Web Speech API implementation (browser-compatible)
    async speakWithWebSpeech(speechItem) {
        return new Promise((resolve, reject) => {
            // This will be handled on the client side via WebSocket
            // Send speech data to client for Web Speech API processing
            this.emit('webspeech-request', {
                id: speechItem.id,
                text: speechItem.text,
                settings: speechItem.settings,
                agent: speechItem.agent
            });
            
            // Estimate speech duration for timing
            const estimatedDuration = this.estimateSpeechDuration(speechItem.text, speechItem.settings.rate);
            setTimeout(resolve, estimatedDuration);
        });
    }
    
    // ElevenLabs API implementation
    async speakWithElevenLabs(speechItem) {
        const axios = require('axios');
        
        const voiceId = this.getVoiceForProvider('elevenlabs', speechItem.settings.voice);
        const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
        
        const response = await axios.post(url, {
            text: speechItem.text,
            model_id: "eleven_monolingual_v1",
            voice_settings: {
                stability: 0.5,
                similarity_boost: 0.5,
                style: 0.0,
                use_speaker_boost: true
            }
        }, {
            headers: {
                'Accept': 'audio/mpeg',
                'Content-Type': 'application/json',
                'xi-api-key': this.apiKeys.elevenlabs
            },
            responseType: 'arraybuffer'
        });
        
        // Save audio file and emit for playback
        const audioPath = await this.saveAudioFile(response.data, speechItem.id, 'mp3');
        this.emit('audio-ready', { ...speechItem, audioPath });
        
        // Estimate playback duration
        const duration = this.estimateSpeechDuration(speechItem.text, speechItem.settings.rate);
        await this.delay(duration);
    }
    
    // Azure Cognitive Services implementation
    async speakWithAzure(speechItem) {
        const axios = require('axios');
        
        const region = process.env.AZURE_SPEECH_REGION || 'eastus';
        const voice = this.getVoiceForProvider('azure', speechItem.settings.voice);
        
        // Get access token
        const tokenResponse = await axios.post(
            `https://${region}.api.cognitive.microsoft.com/sts/v1.0/issuetoken`,
            {},
            {
                headers: {
                    'Ocp-Apim-Subscription-Key': this.apiKeys.azure,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );
        
        const accessToken = tokenResponse.data;
        
        // Generate SSML
        const ssml = this.generateSSML(speechItem.text, voice, speechItem.settings);
        
        // Synthesize speech
        const response = await axios.post(
            `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
            ssml,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/ssml+xml',
                    'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3'
                },
                responseType: 'arraybuffer'
            }
        );
        
        const audioPath = await this.saveAudioFile(response.data, speechItem.id, 'mp3');
        this.emit('audio-ready', { ...speechItem, audioPath });
        
        const duration = this.estimateSpeechDuration(speechItem.text, speechItem.settings.rate);
        await this.delay(duration);
    }
    
    // Generate SSML for Azure
    generateSSML(text, voice, settings) {
        return `
            <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
                <voice name="${voice}">
                    <prosody rate="${settings.rate}" pitch="${settings.pitch > 1 ? '+' : ''}${((settings.pitch - 1) * 50).toFixed(0)}%">
                        ${text}
                    </prosody>
                </voice>
            </speak>
        `;
    }
    
    // Get agent-specific settings
    getAgentSettings(agentName, overrides = {}) {
        const agentConfig = this.agentVoices[agentName] || {};
        return {
            ...this.defaultSettings,
            ...agentConfig,
            ...overrides
        };
    }
    
    // Get voice identifier for specific provider
    getVoiceForProvider(provider, voiceType) {
        const voices = this.availableVoices[provider];
        if (!voices || !voices[voiceType]) {
            return Object.values(voices || {})[0]?.voiceId || Object.values(voices || {})[0]?.voice || 'default';
        }
        return voices[voiceType].voiceId || voices[voiceType].voice || voices[voiceType].name;
    }
    
    // Estimate speech duration based on text length and rate
    estimateSpeechDuration(text, rate = 1.0) {
        const averageWPM = 150; // Average words per minute
        const words = text.split(/\s+/).length;
        const baseMilliseconds = (words / averageWPM) * 60 * 1000;
        return Math.max(1000, baseMilliseconds / rate); // Minimum 1 second
    }
    
    // Save audio file to disk
    async saveAudioFile(audioData, id, format) {
        const audioDir = path.join(__dirname, 'audio');
        await fs.mkdir(audioDir, { recursive: true });
        
        const filename = `speech_${id}.${format}`;
        const filepath = path.join(audioDir, filename);
        
        await fs.writeFile(filepath, audioData);
        return filepath;
    }
    
    // Sanitize text for speech
    sanitizeText(text) {
        return text
            .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold markdown
            .replace(/\*([^*]+)\*/g, '$1')     // Remove italic markdown
            .replace(/`([^`]+)`/g, '$1')       // Remove code markdown
            .replace(/\n+/g, '. ')             // Replace newlines with periods
            .replace(/\s+/g, ' ')              // Normalize whitespace
            .trim();
    }
    
    // Generate unique ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    
    // Utility delay function
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // Clear speech queue
    clearQueue() {
        this.speechQueue = [];
        this.emit('queue-cleared');
    }
    
    // Stop current speech
    stop() {
        this.clearQueue();
        this.isPlaying = false;
        this.currentSpeaker = null;
        this.emit('speech-stopped');
    }
    
    // Update configuration
    updateConfig(newConfig) {
        if (newConfig.enabled !== undefined) this.enabled = newConfig.enabled;
        if (newConfig.provider) this.provider = newConfig.provider;
        if (newConfig.agentVoices) this.agentVoices = { ...this.agentVoices, ...newConfig.agentVoices };
        if (newConfig.defaultSettings) this.defaultSettings = { ...this.defaultSettings, ...newConfig.defaultSettings };
        
        this.emit('config-updated', this.getStatus());
    }
    
    // Get current status
    getStatus() {
        return {
            enabled: this.enabled,
            provider: this.provider,
            isPlaying: this.isPlaying,
            currentSpeaker: this.currentSpeaker,
            queueLength: this.speechQueue.length,
            agentVoices: this.agentVoices,
            defaultSettings: this.defaultSettings,
            availableVoices: this.availableVoices
        };
    }
}

module.exports = TTSService;