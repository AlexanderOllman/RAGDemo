// script.js
document.addEventListener('DOMContentLoaded', function() {
    const socket = io();
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const addFilesButton = document.getElementById('add-files-button');
    const resetButton = document.getElementById('reset-button');
    const llmEndpointInput = document.getElementById('llm-endpoint');

    let conversation = [];

    function addMessage(message, isUser) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('chat-message', isUser ? 'user-message' : 'bot-message');
        messageDiv.textContent = message;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function addThinkingAnimation() {
        const thinkingDiv = document.createElement('div');
        thinkingDiv.classList.add('chat-message', 'bot-message', 'thinking');
        thinkingDiv.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
        chatMessages.appendChild(thinkingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return thinkingDiv;
    }

    sendButton.addEventListener('click', function() {
        const message = userInput.value.trim();
        if (message) {
            addMessage(message, true);
            conversation.push({role: 'user', content: message});
            userInput.value = '';

            const thinkingDiv = addThinkingAnimation();

            socket.emit('chat_message', message);
        }
    });

    socket.on('chat_response', function(data) {
        const thinkingDiv = chatMessages.querySelector('.thinking');
        if (thinkingDiv) {
            thinkingDiv.remove();
        }
        addMessage(data.message, false);
        conversation.push({role: 'assistant', content: data.message});
    });

    addFilesButton.addEventListener('click', function() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt,.pdf,.doc,.docx';
        input.onchange = function(event) {
            const file = event.target.files[0];
            const formData = new FormData();
            formData.append('file', file);

            fetch('/upload_file', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('File uploaded successfully!');
                    updateUploadedFilesList();
                } else {
                    alert('Error uploading file: ' + data.error);
                }
            });
        };
        input.click();
    });

    resetButton.addEventListener('click', function() {
        fetch('/save_conversation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({conversation: conversation})
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                chatMessages.innerHTML = '';
                conversation = [];
                alert('Conversation saved and reset!');
            } else {
                alert('Error saving conversation');
            }
        });
    });

    // For the History page
    const conversationHistory = document.getElementById('conversation-history');
    if (conversationHistory) {
        fetch('/get_conversations')
        .then(response => response.json())
        .then(conversations => {
            conversations.forEach((conv, index) => {
                const convDiv = document.createElement('div');
                convDiv.classList.add('mb-3');
                const toggleButton = document.createElement('button');
                toggleButton.classList.add('btn', 'btn-primary', 'mb-2');
                toggleButton.textContent = `Conversation ${index + 1}`;
                toggleButton.onclick = function() {
                    convContent.style.display = convContent.style.display === 'none' ? 'block' : 'none';
                };
                const convContent = document.createElement('div');
                convContent.style.display = 'none';
                conv.forEach(msg => {
                    const msgDiv = document.createElement('div');
                    msgDiv.classList.add('chat-message', msg.role === 'user' ? 'user-message' : 'bot-message');
                    msgDiv.textContent = msg.content;
                    convContent.appendChild(msgDiv);
                });
                convDiv.appendChild(toggleButton);
                convDiv.appendChild(convContent);
                conversationHistory.appendChild(convDiv);
            });
        });
    }

    // For the Settings page
    const uploadedFilesList = document.getElementById('uploaded-files-list');
    
    function updateUploadedFilesList() {
        if (uploadedFilesList) {
            fetch('/get_uploaded_files')
            .then(response => response.json())
            .then(files => {
                uploadedFilesList.innerHTML = '';
                files.forEach(file => {
                    const li = document.createElement('li');
                    li.textContent = file;
                    const deleteButton = document.createElement('button');
                    deleteButton.textContent = 'Delete';
                    deleteButton.classList.add('btn', 'btn-danger', 'btn-sm', 'ms-2');
                    deleteButton.onclick = function() {
                        deleteFile(file);
                    };
                    li.appendChild(deleteButton);
                    uploadedFilesList.appendChild(li);
                });
            });
        }
    }

    function deleteFile(filename) {
        fetch('/delete_file', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({filename: filename})
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('File deleted successfully!');
                updateUploadedFilesList();
            } else {
                alert('Error deleting file: ' + data.error);
            }
        });
    }

    if (llmEndpointInput) {
        llmEndpointInput.addEventListener('change', function() {
            fetch('/update_llm_endpoint', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({endpoint: llmEndpointInput.value})
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('LLM Endpoint updated successfully!');
                } else {
                    alert('Error updating LLM Endpoint');
                }
            });
        });
    }

    // Initial load of uploaded files list
    updateUploadedFilesList();
});