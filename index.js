import { GoogleGenAI, Modality, HarmCategory, HarmBlockThreshold } from "https://esm.run/@google/genai";

// App State Containers
const apiKeyModal = document.getElementById('apiKeyModal');
const apiKeyInput = document.getElementById('apiKeyInput');
const saveApiKeyButton = document.getElementById('saveApiKeyButton');
const landingPage = document.getElementById('landing-page');
const getStartedBtn = document.getElementById('get-started-btn');
const appContainer = document.getElementById('app-container');

// Main App Elements
const chatContainer = document.getElementById('chat-container');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const imageUploadButton = document.getElementById('image-upload-button');
const imageUploadInput = document.getElementById('image-upload-input');
const imagePreviewContainer = document.getElementById('image-preview-container');
const newChatButton = document.getElementById('newChatButton');
const newChatModal = document.getElementById('newChatModal');
const startFreshButton = document.getElementById('startFreshButton');
const startWithContextButton = document.getElementById('startWithContextButton');
const loadingOverlay = document.getElementById('loadingOverlay');
const visualizeButton = document.getElementById('visualize-button');
const fetchButton = document.getElementById('fetch-button');
const designFlowButton = document.getElementById('design-flow-button');

// Time Table elements
const menuButton = document.getElementById('menuButton');
const dropdownMenu = document.getElementById('dropdownMenu');
const timeTableButton = document.getElementById('timeTableButton');
const timeTableSidebar = document.getElementById('timeTableSidebar');
const timeTableOverlay = document.getElementById('timeTableOverlay');
const timeTableContent = document.getElementById('timeTableContent');
const closeTimeTableButton = document.getElementById('closeTimeTableButton');
const taskInput = document.getElementById('taskInput');
const addTaskButton = document.getElementById('addTaskButton');
const taskList = document.getElementById('taskList');

// Timer elements
const timerModal = document.getElementById('timerModal');
const timerTaskName = document.getElementById('timerTaskName');
const timerInput = document.getElementById('timerInput');
const cancelTimerButton = document.getElementById('cancelTimerButton');
const startTimerButton = document.getElementById('startTimerButton');
const timeUpModal = document.getElementById('timeUpModal');
const timeUpTaskName = document.getElementById('timeUpTaskName');
const completeTaskButton = document.getElementById('completeTaskButton');
const addMoreTimeButton = document.getElementById('addMoreTimeButton');
const activeTimerPopup = document.getElementById('activeTimerPopup');
const popupTaskName = document.getElementById('popupTaskName');
const popupTimeLeft = document.getElementById('popupTimeLeft');

// Audio elements
const taskCompleteSound = document.getElementById('taskCompleteSound');
const timerFinishedSound = document.getElementById('timerFinishedSound');

let ai;
let chatHistory = [];
let currentSystemInstruction = null;
let currentImageState = { base64: null, ocrText: null };
let messageCounter = 0;
let tasks = [];
let activeTimer = null;

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// --- Sound Helper ---
const playSound = (audioElement) => {
    if (audioElement) {
        audioElement.currentTime = 0; // Rewind to start
        audioElement.play().catch(error => console.error("Audio playback failed:", error));
    }
};

// --- Task Management / Time Table ---

const loadTasks = () => {
    const storedTasks = localStorage.getItem('tasks');
    if (storedTasks) {
        tasks = JSON.parse(storedTasks);
    }
    renderTasks();
};

const saveTasks = () => {
    localStorage.setItem('tasks', JSON.stringify(tasks));
};

const renderTasks = () => {
    taskList.innerHTML = '';
    tasks.forEach((task, index) => {
        const li = document.createElement('li');
        li.className = `flex items-center justify-between p-3 rounded-md transition-colors ${task.completed ? 'bg-zinc-800' : 'bg-zinc-700/50'}`;
        
        const isTimerActiveForThisTask = activeTimer && activeTimer.index === index;
        
        li.innerHTML = `
            <div class="flex items-center gap-3 flex-1 min-w-0">
                <input type="checkbox" data-index="${index}" class="task-checkbox h-5 w-5 rounded bg-zinc-800 border-zinc-600 text-blue-500 focus:ring-blue-500" ${task.completed ? 'checked' : ''}>
                <span class="flex-1 truncate ${task.completed ? 'line-through text-zinc-500' : ''}">${task.text}</span>
            </div>
            <div class="flex items-center gap-2">
                ${isTimerActiveForThisTask 
                    ? `<span id="timer-display-${index}" class="font-mono text-lg text-amber-400 tabular-nums">--:--</span>
                       <button data-index="${index}" class="stop-timer-btn p-1 text-zinc-400 hover:text-red-500 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 000-2H9V8a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>
                       </button>`
                    : `<button data-index="${index}" class="start-timer-btn p-1 text-zinc-400 hover:text-green-500 transition-colors ${activeTimer ? 'opacity-50 cursor-not-allowed' : ''}" ${activeTimer ? 'disabled' : ''}>
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" /></svg>
                       </button>`
                }
                <button data-index="${index}" class="delete-task-btn p-1 text-zinc-500 hover:text-red-500 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        `;
        taskList.appendChild(li);
    });
};

const addTask = () => {
    const text = taskInput.value.trim();
    if (text) {
        tasks.push({ text, completed: false });
        taskInput.value = '';
        saveTasks();
        renderTasks();
    }
};

const toggleTask = (index) => {
    tasks[index].completed = !tasks[index].completed;
    if (tasks[index].completed) {
        playSound(taskCompleteSound);
    }
    saveTasks();
    renderTasks();
};

const deleteTask = (index) => {
    tasks.splice(index, 1);
    saveTasks();
    renderTasks();
};

// --- Timer Functions ---
const formatTime = (ms) => {
    const totalSeconds = Math.round(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const updateTimer = () => {
    if (!activeTimer) return;
    const remaining = activeTimer.endTime - Date.now();
    if (remaining <= 0) {
        const taskIndex = activeTimer.index;
        const taskName = tasks[taskIndex].text;
        stopTimer();
        showTimeUpModal(taskName, taskIndex);
        return;
    }

    const formattedTime = formatTime(remaining);

    // Update in-list timer
    const timerDisplay = document.getElementById(`timer-display-${activeTimer.index}`);
    if (timerDisplay) {
        timerDisplay.textContent = formattedTime;
    }

    // Update popup timer
    popupTimeLeft.textContent = formattedTime;
};

const startTimer = (index, minutes) => {
    if (activeTimer) return;
    const endTime = Date.now() + minutes * 60 * 1000;
    const intervalId = setInterval(updateTimer, 1000);
    activeTimer = { index, endTime, intervalId };

    // Show and populate the popup
    popupTaskName.textContent = tasks[index].text;
    activeTimerPopup.classList.remove('hidden');
    
    timerModal.classList.add('hidden');
    renderTasks();
    updateTimer(); // Initial call
};

const stopTimer = () => {
    if (activeTimer) {
        clearInterval(activeTimer.intervalId);
    }
    activeTimer = null;
    
    // Hide the popup
    activeTimerPopup.classList.add('hidden');
    
    renderTasks();
};

const showTimeUpModal = (taskName, index) => {
    playSound(timerFinishedSound);
    timeUpTaskName.textContent = `Time for "${taskName}" is complete.`;
    timeUpModal.dataset.taskIndex = String(index);
    timeUpModal.classList.remove('hidden');
};


// --- Core Chat Functions ---

const initializeChat = (apiKey, systemInstruction = "") => {
  try {
    ai = new GoogleGenAI({ apiKey: apiKey });
    chatContainer.innerHTML = '';
    chatHistory = [];
    currentSystemInstruction = systemInstruction || null;

    if (systemInstruction) {
       addMessage('assistant', `Continuing chat with context.`);
    } else {
       addMessage('assistant', 'Hello! How can I help you today? You can ask me questions, upload images, or use commands like `/visualize` and `/fetch`.');
    }

    resetInputState();
    return true; // Indicate success
  } catch (error) {
      console.error("Initialization failed:", error);
      sessionStorage.removeItem('geminiApiKey'); // Clear bad key
      apiKeyModal.classList.remove('hidden');
      landingPage.classList.add('hidden');
      appContainer.classList.add('hidden');
      const keyInput = document.getElementById('apiKeyInput');
      keyInput.value = '';
      keyInput.placeholder = "Invalid API Key. Please try again.";
      keyInput.classList.add('border-red-500', 'placeholder-red-400');
      return false; // Indicate failure
  }
};

const startNewChat = async (useContext) => {
  const apiKey = sessionStorage.getItem('geminiApiKey');
  if (!apiKey) {
      apiKeyModal.classList.remove('hidden');
      return;
  }
  newChatModal.classList.add('hidden');
  if (useContext && chatHistory.length > 0) {
    loadingOverlay.classList.remove('hidden');
    try {
      const summaryPrompt = `Summarize the following conversation history in one or two sentences to use as context for a new conversation. Focus on the key topics and outcomes:\n\n${JSON.stringify(chatHistory)}`;
      
      const response = await ai.models.generateContent({
         model: 'gemini-2.5-flash',
         contents: summaryPrompt,
      });
      
      initializeChat(apiKey, `PREVIOUS_CONTEXT: ${response.text}`);
    } catch (error) {
      console.error('Error summarizing chat:', error);
      addMessage('assistant', 'Sorry, I couldn\'t summarize the previous chat. Starting a fresh one.');
      initializeChat(apiKey);
    } finally {
      loadingOverlay.classList.add('hidden');
    }
  } else {
    initializeChat(apiKey);
  }
};

const processMarkdown = (text) => {
    const rawHtml = marked.parse(text);
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = rawHtml;

    const tables = tempDiv.querySelectorAll('table');
    tables.forEach(table => {
        if (table.parentElement?.classList.contains('overflow-x-auto')) {
            return; // Already wrapped
        }
        const wrapper = document.createElement('div');
        wrapper.className = 'overflow-x-auto border border-zinc-600 rounded-md';
        table.parentNode?.insertBefore(wrapper, table);
        wrapper.appendChild(table);
    });

    return tempDiv.innerHTML;
};

const addMessage = (role, content, id = null) => {
  const messageId = id || `msg-${messageCounter++}`;
  const messageWrapper = document.createElement('div');
  messageWrapper.className = `w-full flex gap-3 items-end ${role === 'user' ? 'justify-end' : 'justify-start'}`;

  const userIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>`;
  const aiIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M11.983 1.904a1 1 0 00-1.966 0l-4 8a1 1 0 00.983 1.435h3.04l-2.02 5.05a1 1 0 001.966.788l4-10a1 1 0 00-.983-1.435h-3.04l2.02-4.846z" /></svg>`;
  
  const iconDiv = document.createElement('div');
  iconDiv.className = 'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center';

  const messageBubble = document.createElement('div');
  messageBubble.id = messageId;
  messageBubble.className = 'max-w-[90%] sm:max-w-xl lg:max-w-2xl p-4 rounded-2xl';

  if (role === 'user') {
    iconDiv.innerHTML = userIcon;
    iconDiv.className += ' bg-blue-600 text-white';
    messageBubble.className += ' bg-blue-600 text-white rounded-br-lg';
  } else {
    iconDiv.innerHTML = aiIcon;
    iconDiv.className += ' bg-zinc-600 text-zinc-200';
    messageBubble.className += ' bg-zinc-700 text-zinc-200 rounded-bl-lg';
  }

  const proseDiv = document.createElement('div');
  proseDiv.className = 'prose prose-invert break-words';
  // User content might be markdown, other content (like thinking bubble) is raw HTML
  proseDiv.innerHTML = role === 'user' ? processMarkdown(content) : content;
  
  messageBubble.appendChild(proseDiv);
  
  if (role === 'user') {
    messageWrapper.appendChild(messageBubble);
    messageWrapper.appendChild(iconDiv);
  } else {
    messageWrapper.appendChild(iconDiv);
    messageWrapper.appendChild(messageBubble);
  }

  chatContainer.appendChild(messageWrapper);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  return messageId;
};

const updateMessage = (messageId, content, isAlreadyHtml = false) => {
  const messageBubble = document.getElementById(messageId);
  if (messageBubble) {
    const proseDiv = messageBubble.querySelector('.prose');
    if (proseDiv) {
        proseDiv.innerHTML = isAlreadyHtml ? content : processMarkdown(content);
    }
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
};

const typeMessage = async (messageId, fullText) => {
    const words = fullText.split(' ');
    let builtText = '';
    const typingDelay = 35; 

    for (let i = 0; i < words.length; i++) {
        builtText += (i > 0 ? ' ' : '') + words[i];
        const cursor = (i < words.length - 1) ? '▋' : '';
        const processedHtml = processMarkdown(builtText + cursor);
        updateMessage(messageId, processedHtml, true);
        await new Promise(resolve => setTimeout(resolve, typingDelay));
    }
};

const handleImageUpload = (event) => {
  const target = event.target;
  const file = target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onloadend = () => {
    const result = reader.result;
    const base64String = result.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
    currentImageState.base64 = base64String;

    imagePreviewContainer.innerHTML = `
      <div class="relative inline-block">
        <img src="${result}" class="h-16 w-16 object-cover rounded-md">
        <button id="remove-image-btn" class="absolute -top-2 -right-2 bg-zinc-800 rounded-full p-1 text-white">
           <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
    `;

    const statusId = addMessage('assistant', '🔍 Scanning image for text...');
    Tesseract.recognize(result, 'eng')
      .then(({ data: { text } }) => {
        currentImageState.ocrText = text;
        updateMessage(statusId, '✅ Image scanned. Ask a question about it or send to describe.');
      })
      .catch((err) => {
        console.error(err);
        currentImageState.ocrText = null;
        updateMessage(statusId, '⚠️ Could not scan image for text.');
      });

    updateSendButtonState();
  };
  reader.readAsDataURL(file);
};

const handleSendMessage = async () => {
  let userMessage = messageInput.value.trim();
  if (!userMessage && !currentImageState.base64) return;
  
  const isVisualizeCommand = userMessage.startsWith('/visualize ');
  const isFetchCommand = userMessage.startsWith('/fetch ');
  const isDesignFlowCommand = userMessage.startsWith('/designFlow ');

  let promptParts = [];
  let displayContent = userMessage;

  // Handle image part
  if (currentImageState.base64) {
    promptParts.push({ inlineData: { mimeType: 'image/jpeg', data: currentImageState.base64 } });
    displayContent = `<img src="data:image/jpeg;base64,${currentImageState.base64}" class="rounded-lg max-h-64 mb-2">${displayContent}`;
  }

  // Handle text part
  if (userMessage) {
    if (currentImageState.ocrText) {
      const contextualPrompt = `Based on the following context extracted from an image, please answer the user's question. If the question is not related to the context, say so. CONTEXT: '${currentImageState.ocrText}' --- QUESTION: '${userMessage}'`;
      promptParts.push({ text: contextualPrompt });
    } else if (isVisualizeCommand) {
      promptParts.push({ text: userMessage.substring(11) });
    } else if (isFetchCommand) {
      promptParts.push({ text: userMessage.substring(7) });
    } else if (isDesignFlowCommand) {
      promptParts.push({ text: userMessage.substring(12) });
    }
    else {
      promptParts.push({ text: userMessage });
    }
  } else if (currentImageState.base64 && !userMessage) {
     promptParts.push({ text: "Describe this image in detail." });
  }
  
  addMessage('user', displayContent);
  chatHistory.push({ role: 'user', parts: promptParts });
  
  const thinkingId = addMessage('assistant', '<span class="thinking-bubble">Thinking</span>');
  resetInputState();
  
  try {
    if (isVisualizeCommand) {
       await generateVisualization(promptParts[0].text, thinkingId);
       return;
    }
    if (isFetchCommand) {
        await fetchAndDescribe(promptParts[0].text, thinkingId);
        return;
    }
    if (isDesignFlowCommand) {
        await generateFlowchart(promptParts[0].text, thinkingId);
        return;
    }

    const modelConfig = {};
    if (currentSystemInstruction) {
        modelConfig.systemInstruction = currentSystemInstruction;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: chatHistory,
      safetySettings,
      config: modelConfig,
    });
    
    const resultText = response.text;
    chatHistory.push({ role: 'model', parts: [{ text: resultText }] });

    // Check for tables. If found, render instantly. Otherwise, type it out.
    const processedHtmlForCheck = processMarkdown(resultText);
    if (processedHtmlForCheck.includes('<table')) {
        updateMessage(thinkingId, processedHtmlForCheck, true);
    } else {
        await typeMessage(thinkingId, resultText);
    }

  } catch (error) {
    console.error("API Error:", error);
    let friendlyMessage = 'Sorry, something went wrong. Please try again.';
    if (error.message) {
        friendlyMessage = `Sorry, an error occurred: ${error.message}`;
    }
    updateMessage(thinkingId, friendlyMessage);
  }
};

const generateVisualization = async (prompt, messageId) => {
    updateMessage(messageId, "🎨 Generating visualization...");
    try {
        const fullPrompt = `You are a creative visual AI. Generate an image based on the following user request.
        **Strict Rules:**
        - **Style:** The image MUST be minimalistic, simple, and clean. Use a modern, flat aesthetic.
        - **Theme:** Do NOT assume any specific theme (like medicine) unless the user explicitly requests it. Keep it general and neutral.
        - **Clarity:** Ensure the image is highly readable and easy to understand.
        - **Colors:** Do NOT use neon colors. Use a professional and calm color palette.
        - **Spelling:** All text included in the image must be spelled correctly.

        **User Request:** "${prompt}"`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts: [{ text: fullPrompt }] },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });
        
        let htmlResponse = "";
        let imageGenerated = false;
        for (const part of response.candidates[0].content.parts) {
            if (part.text) {
                htmlResponse += marked.parse(part.text);
            } else if (part.inlineData) {
                imageGenerated = true;
                const base64ImageBytes = part.inlineData.data;
                const imageUrl = `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
                htmlResponse += `<img src="${imageUrl}" class="rounded-lg max-w-full" alt="Generated visualization">`;
            }
        }

        if (!imageGenerated) {
            htmlResponse = "The model chose not to generate an image for this prompt.";
        }

        chatHistory.push({ role: 'model', parts: [{ text: `[Generated Image for: ${prompt}] ${htmlResponse}` }] });
        updateMessage(messageId, htmlResponse, true);

    } catch (error) {
        console.error("Visualization Generation Error:", error);
        updateMessage(messageId, `Sorry, something went wrong during visualization. ${error.toString()}`);
    }
};

const fetchAndDescribe = async (prompt, messageId) => {
    updateMessage(messageId, `🔍 Searching for information on "${prompt}"...`);
    try {
        // Step 1: Search the web for a description
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Find factual information and generate a detailed visual description for a minimalistic and simple diagram about: "${prompt}". Also include a concise text explanation.`,
            config: {
                tools: [{ googleSearch: {} }],
            },
        });

        const description = response.text;
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        
        chatHistory.push({ role: 'model', parts: [{ text: description }] });
        
        let htmlResponse = processMarkdown(description);

        if (groundingChunks.length > 0) {
            htmlResponse += '<div class="mt-4 pt-2 border-t border-zinc-600 text-sm"><p class="font-semibold mb-1">Sources:</p><ul class="list-disc pl-5">';
            groundingChunks.forEach((chunk) => {
                if (chunk.web) {
                    htmlResponse += `<li><a href="${chunk.web.uri}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline">${chunk.web.title}</a></li>`;
                }
            });
            htmlResponse += '</ul></div>';
        }
        
        updateMessage(messageId, htmlResponse, true);

    } catch (error) {
        console.error("Fetch and Describe Error:", error);
        updateMessage(messageId, `Sorry, something went wrong while fetching information. ${error.message}`);
    }
};

const generateFlowchart = async (prompt, messageId) => {
    try {
        updateMessage(messageId, `⏳ Researching and designing a flowchart for "${prompt}"...`);

        const flowchartPrompt = `
            Your task is to create a concise, high-level flowchart about the topic: "${prompt}".

            **Instructions:**
            1. Use your knowledge and the available search tool to understand the key stages of the topic.
            2. Generate a high-level flowchart summarizing the process using ONLY HTML and the provided CSS classes.
            3. Generate a concise, one-paragraph explanation of the topic.

            **CSS Classes Available:**
            - \`<div class="flowchart-container">\`
            - \`<div class="flow-node flow-start-end">TEXT</div>\`
            - \`<div class="flow-node flow-process">TEXT</div>\`
            - \`<div class="flow-node flow-decision"><span>TEXT</span></div>\`
            - \`<div class="flow-arrow">...\` (SVG inside)
            - \`<div class="flow-decision-branches">\`
            - \`<div class="flow-branch">\`
            - \`<div class="flow-branch-label">Yes/No</div>\`

            **Final Output Format:**
            You MUST structure your entire response within a single <final_output> block. Inside it, you MUST provide two tags: <flowchart_html> and <explanation>.
            - The <flowchart_html> tag must contain ONLY the HTML code for the flowchart.
            - The <explanation> tag must contain ONLY the text for the one-paragraph explanation.
            - Do NOT include any other text, markdown, or conversational preamble outside of these tags.

            Example structure:
            <final_output>
                <flowchart_html>
                    <div class="flowchart-container">...</div>
                </flowchart_html>
                <explanation>
                    This is the brief explanation of the topic.
                </explanation>
            </final_output>
        `;

        const flowchartResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: flowchartPrompt,
            config: {
                tools: [{ googleSearch: {} }],
            },
        });

        const rawResponse = flowchartResponse.text;

        const flowchartMatch = rawResponse.match(/<flowchart_html>([\s\S]*?)<\/flowchart_html>/);
        const explanationMatch = rawResponse.match(/<explanation>([\s\S]*?)<\/explanation>/);

        if (flowchartMatch && flowchartMatch[1] && explanationMatch && explanationMatch[1]) {
            const flowchartHtmlContent = flowchartMatch[1].trim();
            const explanationText = explanationMatch[1].trim();
            
            const finalHtml = `
                ${flowchartHtmlContent}
                <p class="mt-6 text-sm text-zinc-400">${explanationText}</p>
            `;

            chatHistory.push({ role: 'model', parts: [{ text: `[Flowchart for: ${prompt}] ${finalHtml}` }] });
            updateMessage(messageId, finalHtml, true);
        } else {
            console.error("Failed to parse flowchart response:", rawResponse);
            const errorMessage = "Sorry, I couldn't generate the flowchart in the correct format. Please try rephrasing your request.";
            chatHistory.push({ role: 'model', parts: [{ text: errorMessage }] });
            updateMessage(messageId, errorMessage);
        }

    } catch (error) {
        console.error("Flowchart Generation Error:", error);
        updateMessage(messageId, `Sorry, something went wrong while generating the flowchart. ${error.message}`);
    }
};


const resetInputState = () => {
  messageInput.value = '';
  currentImageState = { base64: null, ocrText: null };
  imagePreviewContainer.innerHTML = '';
  if (document.getElementById('image-upload-input')) {
    document.getElementById('image-upload-input').value = '';
  }
  autosizeInput();
  updateSendButtonState();
};

const autosizeInput = () => {
  messageInput.style.height = 'auto';
  messageInput.style.height = (messageInput.scrollHeight) + 'px';
};

const updateSendButtonState = () => {
  sendButton.disabled = !messageInput.value.trim() && !currentImageState.base64;
};

// --- Event Listeners ---

const showApp = () => {
    landingPage.style.opacity = '0';
    setTimeout(() => {
        landingPage.classList.add('hidden');
        appContainer.classList.remove('hidden');
        setTimeout(() => {
            appContainer.style.opacity = '1';
        }, 50); // Small delay to ensure the 'hidden' class is removed before transition starts
    }, 700); // Match the transition duration in CSS
};

getStartedBtn.addEventListener('click', showApp);

saveApiKeyButton.addEventListener('click', () => {
    const apiKeyInputEl = document.getElementById('apiKeyInput');
    const apiKey = apiKeyInputEl.value.trim();
    if (apiKey) {
        apiKeyInputEl.classList.remove('border-red-500', 'placeholder-red-400');
        const success = initializeChat(apiKey);
        if (success) {
            sessionStorage.setItem('geminiApiKey', apiKey);
            apiKeyModal.classList.add('hidden');
            landingPage.classList.remove('hidden');
        }
    } else {
        apiKeyInputEl.placeholder = "API Key cannot be empty!";
        apiKeyInputEl.classList.add('border-red-500', 'placeholder-red-400');
    }
});


sendButton.addEventListener('click', handleSendMessage);
messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSendMessage();
  }
});

messageInput.addEventListener('input', () => {
  autosizeInput();
  updateSendButtonState();
});

imageUploadButton.addEventListener('click', () => imageUploadInput.click());
imageUploadInput.addEventListener('change', handleImageUpload);

imagePreviewContainer.addEventListener('click', (e) => {
  const target = e.target;
  if (target.closest('#remove-image-btn')) {
    resetInputState();
  }
});

newChatButton.addEventListener('click', () => newChatModal.classList.remove('hidden'));
startFreshButton.addEventListener('click', () => startNewChat(false));
startWithContextButton.addEventListener('click', () => startNewChat(true));
newChatModal.addEventListener('click', (e) => {
  if (e.target === newChatModal) newChatModal.classList.add('hidden');
});

visualizeButton.addEventListener('click', () => {
    messageInput.value = '/visualize ';
    messageInput.focus();
    updateSendButtonState();
});

fetchButton.addEventListener('click', () => {
    messageInput.value = '/fetch ';
    messageInput.focus();
    updateSendButtonState();
});

designFlowButton.addEventListener('click', () => {
    messageInput.value = '/designFlow ';
    messageInput.focus();
    updateSendButtonState();
});


// Time Table Listeners
menuButton.addEventListener('click', (e) => {
  e.stopPropagation();
  dropdownMenu.classList.toggle('hidden');
});

document.addEventListener('click', () => {
  if (!dropdownMenu.classList.contains('hidden')) {
    dropdownMenu.classList.add('hidden');
  }
});

timeTableButton.addEventListener('click', (e) => {
  e.preventDefault();
  timeTableSidebar.classList.remove('hidden');
  setTimeout(() => {
    timeTableContent.classList.remove('translate-x-full');
  }, 10);
});

const closeSidebar = () => {
  timeTableContent.classList.add('translate-x-full');
  setTimeout(() => {
    timeTableSidebar.classList.add('hidden');
  }, 300);
};

closeTimeTableButton.addEventListener('click', closeSidebar);
timeTableOverlay.addEventListener('click', closeSidebar);

addTaskButton.addEventListener('click', addTask);
taskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        addTask();
    }
});

taskList.addEventListener('click', (e) => {
    const target = e.target;
    const checkbox = target.closest('.task-checkbox');
    if (checkbox) {
        toggleTask(Number(checkbox.dataset.index));
    }
    const deleteBtn = target.closest('.delete-task-btn');
    if (deleteBtn) {
        deleteTask(Number(deleteBtn.dataset.index));
    }
    const startBtn = target.closest('.start-timer-btn');
    if (startBtn && !startBtn.disabled) {
        const index = Number(startBtn.dataset.index);
        timerTaskName.textContent = `Task: "${tasks[index].text}"`;
        timerInput.value = '25';
        timerModal.dataset.taskIndex = String(index);
        timerModal.classList.remove('hidden');
    }
    const stopBtn = target.closest('.stop-timer-btn');
    if (stopBtn) {
        stopTimer();
    }
});

// Timer Modal Listeners
cancelTimerButton.addEventListener('click', () => timerModal.classList.add('hidden'));
timerModal.addEventListener('click', (e) => {
    if (e.target === timerModal) timerModal.classList.add('hidden');
});

startTimerButton.addEventListener('click', () => {
    const index = timerModal.dataset.taskIndex;
    const minutes = parseInt(timerInput.value, 10);
    if (index !== undefined && minutes > 0) {
        startTimer(Number(index), minutes);
    }
});

// Time's Up Modal Listeners
completeTaskButton.addEventListener('click', () => {
    const taskIndex = timeUpModal.dataset.taskIndex;
    if (taskIndex !== undefined) {
        const index = Number(taskIndex);
        if (!tasks[index].completed) {
            toggleTask(index);
        }
    }
    timeUpModal.classList.add('hidden');
});

addMoreTimeButton.addEventListener('click', () => {
    const taskIndex = timeUpModal.dataset.taskIndex;
    if (taskIndex !== undefined) {
        const index = Number(taskIndex);
        timerTaskName.textContent = `Task: "${tasks[index].text}"`;
        timerInput.value = '10'; // Default to 10 more minutes
        timerModal.dataset.taskIndex = String(index);
        timeUpModal.classList.add('hidden');
        timerModal.classList.remove('hidden');
        timerInput.focus();
    }
});

timeUpModal.addEventListener('click', (e) => {
    if (e.target === timeUpModal) timeUpModal.classList.add('hidden');
});


// --- App Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    loadTasks(); // Load tasks regardless of API key state
    const storedApiKey = sessionStorage.getItem('geminiApiKey');
    
    if (storedApiKey) {
        const success = initializeChat(storedApiKey);
        if (success) {
            apiKeyModal.classList.add('hidden');
            landingPage.classList.remove('hidden');
            appContainer.classList.add('hidden');
        }
        // if !success, initializeChat already showed the modal
    } else {
        apiKeyModal.classList.remove('hidden');
        landingPage.classList.add('hidden');
        appContainer.classList.add('hidden');
    }
});
