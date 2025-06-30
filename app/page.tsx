"use client";
import { useChat } from "ai/react";
import { useState, useRef, useEffect } from "react";
import dynamic from 'next/dynamic';

// استيراد EmojiPicker بشكل ديناميكي
const EmojiPicker = dynamic(() => import('emoji-picker-react').then(mod => mod.default), {
  ssr: false,
  loading: () => <div className="emoji-picker-loading">جاري التحميل...</div>
});

const Bubble = ({ message }) => {
  const { content, role } = message;
  return (
    <div className={`message ${role === "user" ? "user-message" : "bot-message"}`}>
      {role === "assistant" && (
        <div className="bot-avatar">
          <img src="/wamed_logo.jpg" className="chatbot-logo" alt="Bot" />
        </div>
      )}
      <div className="message-text">{content}</div>
    </div>
  );
};

const LoadingBubble = () => {
  return (
    <div className="message bot-message thinking">
      <div className="bot-avatar">
        <img src="/wamed_logo.jpg" className="chatbot-logo" alt="Bot" />
      </div>
      <div className="message-text">
        <div className="thinking-indicator">
          <div className="dot"></div>
          <div className="dot"></div>
          <div className="dot"></div>
        </div>
      </div>
    </div>
  );
};

const PromptSuggestionButton = ({ text, onClick }) => {
  return (
    <button className="prompt-suggestion-button" onClick={onClick}>
      {text}
    </button>
  );
};

const PromptSuggestionsRow = ({ onPromptClick }) => {
  const prompts = [
    "ما هي خدمات التسويق الرقمي التي تقدمونها؟",
    "هل تقدمون خدمات استشارية؟",
    "كيف يمكنني الحصول على شهادة الأيزو بمساعدتكم؟",
  ];
  return (
    <div className="prompt-suggestion-row">
      {prompts.map((prompt, index) => (
        <PromptSuggestionButton
          key={`suggestion-${index}`}
          text={prompt}
          onClick={() => onPromptClick(prompt)}
        />
      ))}
    </div>
  );
};

const Home = () => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef(null);
  const chatBodyRef = useRef(null);

  const { append, isLoading, messages, input, handleInputChange, handleSubmit, setInput } =
    useChat();
  const noMessages = !messages || messages.length === 0;

  // Auto-scroll إلى أسفل عند وصول رسائل جديدة
  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // إرسال الرسالة عند الضغط Enter (مع دعم Shift+Enter لسطر جديد)
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() !== "") handleSubmit(e);
    }
  };

  const handleEmojiSelect = (emojiData) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText = input.slice(0, start) + emojiData.emoji + input.slice(end);
      setInput(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + emojiData.emoji.length, start + emojiData.emoji.length);
      }, 0);
    }
    setShowEmojiPicker(false);
  };

  const handlePrompt = (promptText) => {
    append({
      content: promptText,
      role: "user"
    });
  };

  return (
    <div className="Chatbot-popup">
      <div className="chat-header">
        <div className="header-info">
          <img src="/wamed_logo.jpg" className="chatbot-logo" alt="Bot" />
          <span className="logo-text">Wamedbot</span>
        </div>
      </div>
      <div className="chat-body" ref={chatBodyRef}>
        {noMessages ? (
          <>
            <Bubble message={{
              content: "مرحباً! أنا (wamedbot) 😊 كيف أقدر أساعدك اليوم؟ اسألني عن خدمات التسويق الرقمي، التصميم، أو إدارة السوشيال ميديا.",
              role: "assistant"
            }} />
            <PromptSuggestionsRow onPromptClick={handlePrompt} />
          </>
        ) : (
          <>
            {messages.map((message, index) => (
              <Bubble key={`message-${index}`} message={message} />
            ))}
            {isLoading && (messages.length === 0 || messages[messages.length - 1].role === "user") && <LoadingBubble />}
          </>
        )}
      </div>
      <div className="chat-footer">
        <form className="chat-form" onSubmit={handleSubmit} autoComplete="off">
          <textarea
            ref={textareaRef}
            className="message-input"
            onChange={handleInputChange}
            value={input}
            placeholder="ask me anything..."
            rows={1}
            style={{ resize: "none", height: 54 }}
            required
            onKeyDown={handleKeyDown}
          />
          <div className="chat-controls">
            <button
              type="button"
              className="emoji-button-trigger"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              title="إضافة رمز تعبيري"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                <path d="M8 14s1.5 2 4 2 4-2 4-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9 9h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M15 9h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button
              id="send-message"
              type="submit"
              disabled={input.trim() === ""}
              style={{ paddingLeft: '4px' }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M3 21L21 12L3 3V10L17 12L3 14V21Z" fill="currentColor"/>
              </svg>
            </button>
          </div>
        </form>
      </div>
      {showEmojiPicker && (
        <div className="emoji-picker-overlay" onClick={() => setShowEmojiPicker(false)}>
          <div className="emoji-picker" onClick={e => e.stopPropagation()}>
            <EmojiPicker
              onEmojiClick={handleEmojiSelect}
              width={350}
              height={400}
              searchPlaceholder="البحث عن رمز تعبيري..."
              skinTonesDisabled
              previewConfig={{
                showPreview: false
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;