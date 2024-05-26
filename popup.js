document.addEventListener("DOMContentLoaded", () => {
  const chatContainer = document.getElementById("chat");
  const userInput = document.getElementById("userInput");
  const sendButton = document.getElementById("sendButton");

  chrome.storage.local.get(["chatHistory"], (data) => {
    if (data.chatHistory) {
      data.chatHistory.forEach((message) =>
        appendMessage(message.role, message.content)
      );
    }
  });

  sendButton.addEventListener("click", () => {
    const message = userInput.value.trim();
    if (message === "") return;

    // Get the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];

      // Execute a content script to get the document of the active tab
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
          // Extract page content from the result
          const pageContent = result[0].result;

          // Append user message with page content
          const fullMessage = `${message} : ${pageContent}`;
          appendMessage("user", message);

          // Call API with the combined message
          const apiUrl = "http://localhost:1234/v1/chat/completions";
          fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: [{ role: "user", content: fullMessage }],
            }),
          })
            .then((response) => response.json())
            .then((data) => {
              if (data && data.choices && data.choices[0]) {
                const responseMessage = data.choices[0].message.content;
                appendMessage("assistant", responseMessage);
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
