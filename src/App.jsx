import React, { useState, useEffect } from "react";
import axios from "axios";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPaperPlane,
  faPlus,
  faRightFromBracket,
  faBars,
} from "@fortawesome/free-solid-svg-icons";
import { GoogleOAuthProvider, useGoogleLogin } from "@react-oauth/google";

function App() {
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [chatId, setChatId] = useState(null);
  const [threads, setThreads] = useState({});
  const [aiTyping, setAiTyping] = useState(false);
  const [typingMessage, setTypingMessage] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false); // Initially closed on all screens

  useEffect(() => {
    const storedUser = localStorage.getItem("chatbotUser");
    const storedThreads = JSON.parse(localStorage.getItem("chatbotThreads")) || {};
    const storedChatId = localStorage.getItem("currentChatId");

    if (storedUser) {
      setUser(JSON.parse(storedUser));
      setIsLoggedIn(true);
    }

    setThreads(storedThreads);

    if (storedChatId && storedThreads[storedChatId]) {
      setChatId(storedChatId);
      setChatHistory(storedThreads[storedChatId].messages || []);
    }
  }, []);

  const login = useGoogleLogin({
    onSuccess: async (response) => {
      const { access_token } = response;

      try {
        const res = await axios.get("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${access_token}` },
        });

        const userInfo = res.data;
        setUser(userInfo);
        setIsLoggedIn(true);
        localStorage.setItem("chatbotUser", JSON.stringify(userInfo));

        await axios.post("http://localhost:8000/users", {
          sub: userInfo.sub,
          fullName: userInfo.name,
          emailID: userInfo.email,
          familyName: userInfo.family_name,
          picture: userInfo.picture,
          phoneNumber: "",
          conversationHistory: [],
        });

        const chats = await axios.get(`http://localhost:8000/chats/${userInfo.sub}`);
        const loadedThreads = {};
        chats.data.forEach(chat => {
          loadedThreads[chat.chat_id] = {
            title: chat.title || chat.chat_id,
            messages: chat.messages || [],
          };
        });

        setThreads(loadedThreads);
        localStorage.setItem("chatbotThreads", JSON.stringify(loadedThreads));
        setShowLoginModal(false);
      } catch (err) {
        console.error("Login or backend sync failed:", err);
      }
    },
    onError: (error) => {
      console.error("Google Login Failed:", error);
    },
  });

  const logout = () => {
    localStorage.clear();
    setUser(null);
    setIsLoggedIn(false);
    setChatId(null);
    setChatHistory([]);
    setThreads({});
  };

  const sendMessage = async () => {
    if (!isLoggedIn) {
      setShowLoginModal(true);
      return;
    }

    if (message.trim() === "") return;

    const userMessage = { sender: "user", message, timestamp: new Date().toISOString() };
    const updatedChat = [...chatHistory, userMessage];

    setChatHistory(updatedChat);
    setMessage("");
    setAiTyping(true);
    setTypingMessage("...");

    try {
      const response = await axios.post("http://localhost:8000/chat", {
        user,
        message,
        chat_id: chatId,
      });

      const aiText = response.data.reply;
      const newChatId = response.data.chat_id || chatId;
      if (!chatId) setChatId(newChatId);

      let typedText = "";
      let idx = 0;

      const interval = setInterval(() => {
        if (idx < aiText.length) {
          typedText += aiText[idx];
          setTypingMessage(typedText + "|");
          idx++;
        } else {
          clearInterval(interval);

          const aiMessage = {
            sender: "ai",
            message: aiText,
            timestamp: new Date().toISOString(),
          };

          const fullChat = [...updatedChat, aiMessage];

          const updatedThreads = {
            ...threads,
            [newChatId]: {
              title: threads[newChatId]?.title || message.slice(0, 20),
              messages: fullChat,
            },
          };

          setThreads(updatedThreads);
          setChatHistory(fullChat);
          setChatId(newChatId);

          localStorage.setItem("chatbotThreads", JSON.stringify(updatedThreads));
          localStorage.setItem("currentChatId", newChatId);

          setAiTyping(false);
          setTypingMessage("");
        }
      }, 10);
    } catch (error) {
      console.error("Error sending message:", error);
      setChatHistory((prev) => [
        ...prev,
        { sender: "ai", message: "Error: AI couldn't respond." },
      ]);
      setAiTyping(false);
      setTypingMessage("");
    }
  };

  const startNewChat = () => {
    setChatId(null);
    setChatHistory([]);
    localStorage.removeItem("currentChatId");
  };

  const loadThread = async (id) => {
    if (!id) return;

    try {
      const res = await axios.get(`http://localhost:8000/chat/${id}`);

      let messages = [];

      if (Array.isArray(res.data)) {
        messages = res.data;
      } else if (Array.isArray(res.data.conversationHistory)) {
        messages = res.data.conversationHistory;
      } else if (Array.isArray(res.data.messages)) {
        messages = res.data.messages;
      } else {
        console.warn("Unexpected response structure:", res.data);
      }

      const validMessages = messages.filter(msg => msg?.sender && msg?.message);

      setChatId(id);
      setChatHistory(validMessages);

      setThreads((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          messages: validMessages,
        },
      }));

      localStorage.setItem("currentChatId", id);
    } catch (error) {
      console.error("Error loading thread:", error);
      setChatHistory([
        { sender: "ai", message: "Failed to load this conversation." },
      ]);
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <GoogleOAuthProvider clientId="664911476950-vvsp4lnnng7c30gl9ivm0en8rldm2ht8.apps.googleusercontent.com">
      <div className="flex h-screen w-screen bg-gradient-to-r from-teal-100 to-teal-50 text-[#12343b]">
        {/* Sidebar */}
        <div
          className={`fixed top-0 left-0 h-full bg-teal-800 text-white p-4 space-y-4 overflow-y-auto rounded-r-lg shadow-md transition-transform duration-300 z-50 ${
            sidebarOpen ? "translate-x-0 w-64" : "-translate-x-full w-0"
          }`}
        >
          <div className="flex items-center justify-end mb-4">
            <button onClick={toggleSidebar} className="text-gray-400 hover:text-gray-600 focus:outline-none">
              <FontAwesomeIcon icon={faBars} />
            </button>
          </div>

          <div className={`${sidebarOpen ? 'block' : 'hidden'}`}>
            <h2 className="text-xl font-semibold mb-4">My Chat</h2>
            <div className="space-y-2">
              <button onClick={startNewChat} className="flex items-center space-x-2 text-teal-300 hover:text-teal-600 w-full">
                <FontAwesomeIcon icon={faPlus} /> <span>New Chat</span>
              </button>
              {isLoggedIn && (
                <button onClick={logout} className="flex items-center space-x-2 text-red-400 hover:text-red-600 w-full">
                  <FontAwesomeIcon icon={faRightFromBracket} /> <span>Logout</span>
                </button>
              )}
            </div>

            <div className="mt-4">
              <h3 className="font-semibold text-gray-300 mb-2">Previous Chats</h3>
              {Object.entries(threads).map(([id], index) => (
                <div
                  key={id}
                  onClick={() => loadThread(id)}
                  className={`p-3 my-1 rounded-lg cursor-pointer ${id === chatId ? "bg-teal-600" : "bg-teal-700"} hover:bg-teal-500 transition-all duration-300 truncate`}
                >
                  Chat - {index + 1}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chat Area */}
        <div className={`flex-grow p-6 flex flex-col justify-between bg-white rounded-lg shadow-lg relative`}>
          {/* Hamburger Menu for Sidebar Toggle */}
          <button
            onClick={toggleSidebar}
            className="absolute top-4 left-4 bg-teal-600 text-white p-2 rounded-md shadow focus:outline-none z-40"
          >
            <FontAwesomeIcon icon={faBars} />
          </button>

          {showLoginModal && !isLoggedIn && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white p-8 rounded-lg shadow-lg text-center">
                <h2 className="text-xl font-semibold mb-4">Please log in</h2>
                <button onClick={() => login()} className="bg-teal-600 text-white py-2 px-6 rounded-lg hover:bg-teal-700">
                  Login with Google
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col h-full">
            <div className="flex-grow overflow-auto p-4 space-y-4 bg-[#e5f9f7] rounded-lg shadow-inner">
              {chatHistory.map((msg, index) => (
                <div key={index} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] p-3 my-2 rounded-xl ${msg.sender === "user" ? "bg-teal-500 text-white" : "bg-gray-200 text-gray-700 shadow-md"}`}>
                    {msg.message}
                  </div>
                </div>
              ))}
              {aiTyping && (
                <div className="p-3 rounded-lg bg-gray-300 text-black animate-pulse">
                  <span className="font-bold">AI: </span>
                  <span>{typingMessage}</span>
                </div>
              )}
            </div>

            <div className="flex items-center mt-4 p-4 bg-white rounded-lg shadow">
              <input
                type="text"
                className="flex-grow p-3 rounded-lg border-2 border-gray-300 focus:outline-none focus:border-teal-500"
                placeholder="Type a message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              />
              <button onClick={sendMessage} className="ml-4 bg-teal-500 hover:bg-teal-600 text-white p-3 rounded-full transition-all duration-200">
                <FontAwesomeIcon icon={faPaperPlane} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </GoogleOAuthProvider>
  );
}

export default App;