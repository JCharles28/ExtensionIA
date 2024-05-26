document.addEventListener("DOMContentLoaded", () => {
  const chatContainer = document.getElementById("chat");
  const userInput = document.getElementById("userInput");
  const sendButton = document.getElementById("sendButton");
  const clearButton = document.getElementById("clearButton");
  const autoSendCheckbox = document.getElementById("autoSendCheckbox");
  var chatHistory = [];

  chrome.storage.local.get(["chatHistory"], (data) => {
    if (data.chatHistory) {
      data.chatHistory.forEach((message) =>
        appendMessage(message.role, message.content)
      );
      data.chatHistory.forEach((message) =>
        chatHistory.push({
          role: message.role,
          content:
            message.content +
            (message.context ? "\n\nContexte : " + message.context : ""),
        })
      );
    }
  });

  clearButton.addEventListener("click", () => {
    chrome.storage.local.set({ chatHistory: [] });
    chatContainer.innerHTML = "";
    chatHistory = [];
  });

  sendButton.addEventListener("click", () => {
    const message = userInput.value.trim();
    if (message === "") return;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];

      chrome.scripting.executeScript(
        {
          target: { tabId: activeTab.id },
          function: () => {
            return document.documentElement.innerHTML
              .replace(/<style([\s\S]*?)<\/style>/gi, "")
              .replace(/<script([\s\S]*?)<\/script>/gi, "")
              .replace(/<\/div>/gi, "\n")
              .replace(/<\/li>/gi, "\n")
              .replace(/<\/tr>/gi, "\n")
              .replace(/<li>/gi, "  *  ")
              .replace(/<\/ul>/gi, "\n")
              .replace(/<\/p>/gi, "\n")
              .replace(/<br\s*[\/]?>/gi, "\n")
              .replace(/<[^>]+>/gi, "")
              .replace(/\n+\s+/g, "\n");
          },
        },
        (result) => {
          const pageContent = result[0].result;

          if (autoSendCheckbox.checked) {
            context = pageContent;
          } else {
            context = "";
          }
          appendMessage("user", message);
          chatHistory.push({
            role: "user",
            content: message + (context ? "\n\nContexte : " + context : ""),
          });

          addMessageToHistory("user", message, context);
          const apiUrl = "http://localhost:1234/v1/chat/completions";
          fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: chatHistory.map((message) => ({
                role: message.role,
                content: message.content,
              })),
            }),
          })
            .then((response) => response.json())
            .then((data) => {
              if (data && data.choices && data.choices[0]) {
                const responseMessage = data.choices[0].message.content;
                appendMessage("assistant", responseMessage);
                chatHistory.push({
                  role: "assistant",
                  content: responseMessage,
                });
                addMessageToHistory("assistant", responseMessage);
              } else {
                appendMessage("error", "Erreur lors de l'appel à l'API");
              }
            })
            .catch((error) => {
              appendMessage("error", `Erreur : ${error.message}`);
            });
        }
      );
    });

    userInput.value = "";
  });

  function addMessageToHistory(role, content, context = "") {
    chrome.storage.local.get(["chatHistory"], (data) => {
      let chatHistory = data.chatHistory || []; // Initialiser si vide
      let newMessage = { role: role, content: content, context: context };
      chatHistory.push(newMessage);
      chrome.storage.local.set({ chatHistory: chatHistory });
    });
  }

  function appendMessage(role, content) {
    const messageElement = document.createElement("div");
    messageElement.classList.add(
      "message",
      role === "user" ? "user-message" : "assistant-message"
    );

    const roleText = role === "user" ? "You" : "Assistant";
    const timestamp = new Date().toLocaleString();

    messageElement.innerHTML = `
      <div><strong>${roleText}</strong> (${timestamp}):</div>
      <div>${marked.marked(content)}</div>
    `;

    chatContainer.appendChild(messageElement);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
});
