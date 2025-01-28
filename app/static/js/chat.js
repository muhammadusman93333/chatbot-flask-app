document.addEventListener('DOMContentLoaded', function() {
    const chatbox = document.getElementById('chatbox');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const micButton = document.getElementById('mic-button');
    const typingIndicator = document.getElementById('typing-indicator');
    const callButton = document.getElementById('call-button');
    const remoteAudio = document.getElementById('remote-audio');
    const callingOverlay = document.getElementById('calling-overlay');
    const callTimer = document.getElementById('call-timer');
    const callingStatus = document.querySelector('.calling-status');
    const endCallButton = document.getElementById('end-call-button');
    let peerConnection = null;
    let dataChannel = null;
    let callInterval;
    let callStartTime;

    // Speech Recognition Setup
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';

    // Speech Synthesis Setup
    const synth = window.speechSynthesis;

    function addMessage(message, isUser) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
        
        const icon = document.createElement('i');
        icon.className = isUser ? 'fas fa-user' : 'fas fa-robot';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = message;
        
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'message-actions';
        
        if (!isUser) {
            const speakButton = document.createElement('button');
            speakButton.innerHTML = '<i class="fas fa-volume-up"></i>';
            speakButton.title = 'Listen to message';
            speakButton.onclick = () => speakText(message);
            actionsDiv.appendChild(speakButton);
        }
        
        messageDiv.appendChild(icon);
        messageDiv.appendChild(contentDiv);
        messageDiv.appendChild(actionsDiv);
        chatbox.appendChild(messageDiv);
        chatbox.scrollTop = chatbox.scrollHeight;
    }

    async function sendMessage() {
        const message = userInput.value.trim();
        if (!message) return;

        // Add user message
        addMessage(message, true);
        userInput.value = '';
        userInput.disabled = true;
        sendButton.disabled = true;
        typingIndicator.style.display = 'inline-flex';

        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: message })
            });

            const data = await response.json();
            addMessage(data.response, false);
        } catch (error) {
            console.error('Error:', error);
            addMessage('Sorry, there was an error processing your request.', false);
        } finally {
            userInput.disabled = false;
            sendButton.disabled = false;
            typingIndicator.style.display = 'none';
            userInput.focus();
        }
    }

    function showCallingOverlay(status = 'Connecting...') {
        callingOverlay.classList.add('active');
        callingStatus.textContent = status;
        document.querySelector('.chat-container').style.position = 'relative';
    }

    function hideCallingOverlay() {
        callingOverlay.classList.remove('active');
        stopCallTimer();
    }

    function startCallTimer() {
        callStartTime = Date.now();
        callTimer.style.display = 'block';
        callInterval = setInterval(updateCallTimer, 1000);
    }

    function stopCallTimer() {
        clearInterval(callInterval);
        callTimer.textContent = '00:00';
        callTimer.style.display = 'none';
    }

    function updateCallTimer() {
        const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        callTimer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    async function startCall() {
        try {
            showCallingOverlay('Connecting...');
            
            // Get ephemeral token
            const tokenResponse = await fetch("/get-token");
            if (!tokenResponse.ok) {
                throw new Error(`HTTP error! status: ${tokenResponse.status}`);
            }
            const data = await tokenResponse.json();
            if (data.error) {
                throw new Error(data.error);
            }
            console.log("Token response:", data); // Debug log
            const EPHEMERAL_KEY = data.client_secret.value;

            // Create peer connection
            peerConnection = new RTCPeerConnection();

            // Set up remote audio
            peerConnection.ontrack = e => remoteAudio.srcObject = e.streams[0];

            // Add local audio track
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: true
            });
            peerConnection.addTrack(mediaStream.getTracks()[0]);

            // Set up data channel
            dataChannel = peerConnection.createDataChannel("oai-events");
            dataChannel.addEventListener("message", handleRealTimeMessage);

            // Create and set local description
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);

            // Connect to OpenAI Realtime API
            const baseUrl = "https://api.openai.com/v1/realtime";
            const model = "gpt-4o-realtime-preview-2024-12-17";
            const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
                method: "POST",
                body: offer.sdp,
                headers: {
                    Authorization: `Bearer ${EPHEMERAL_KEY}`,
                    "Content-Type": "application/sdp"
                },
            });

            const answer = {
                type: "answer",
                sdp: await sdpResponse.text(),
            };
            await peerConnection.setRemoteDescription(answer);

            callingStatus.textContent = 'Connected';
            startCallTimer();

            callButton.classList.add('active');
        } catch (error) {
            console.error('Call error:', error);
            callingStatus.textContent = 'Call Failed';
            setTimeout(() => {
                hideCallingOverlay();
            }, 2000);
            addMessage('Failed to establish call: ' + error.message, false);
            endCall();
        }
    }

    function handleRealTimeMessage(event) {
        const realtimeEvent = JSON.parse(event.data);
        console.log('Realtime event:', realtimeEvent);
        
        if (realtimeEvent.type === 'text.content') {
            addMessage(realtimeEvent.text, false);
        }
    }

    function endCall() {
        if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
        }
        if (dataChannel) {
            dataChannel.close();
            dataChannel = null;
        }
        hideCallingOverlay();
        callButton.classList.remove('active');
    }

    function startSpeechRecognition() {
        recognition.start();
        micButton.classList.add('recording');
    }

    function speakText(text) {
        const utterance = new SpeechSynthesisUtterance(text);
        synth.speak(utterance);
    }

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        userInput.value = transcript;
        sendMessage();
    };

    recognition.onend = () => {
        micButton.classList.remove('recording');
    };

    // Event Listeners
    sendButton.addEventListener('click', sendMessage);
    
    micButton.addEventListener('click', () => {
        if (micButton.classList.contains('recording')) {
            recognition.stop();
        } else {
            startSpeechRecognition();
        }
    });

    callButton.addEventListener('click', () => {
        if (callButton.classList.contains('active')) {
            endCall();
        } else {
            startCall();
        }
    });

    endCallButton.addEventListener('click', endCall);

    userInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // Welcome message
    setTimeout(() => {
        const welcomeMessage = 'Hello! How can I help you today?';
        addMessage(welcomeMessage, false);
        speakText(welcomeMessage);
    }, 500);
});
