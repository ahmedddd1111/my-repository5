"use client";
import Image from "next/image";
import { useChat } from "ai/react";
import { Message } from "ai";
import { useState, useRef } from "react";

const Bubble = ({ message }) => {
  const { content, role } = message;
  return (
    <div className={`message ${role === "user" ? "user-message" : "bot-message"}`}>
      {role === "assistant" && (
        <div className="bot-avatar">
          <img src="/ChatGPT.png" className="chatbot-logo" alt="Bot" />
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
        <img src="/ChatGPT.png" className="chatbot-logo" alt="Bot" />
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

const EmojiPicker = ({ onEmojiSelect, isOpen, onClose }) => {
  const emojis = [
    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
    '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
    '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
    '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
    '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬',
    '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗',
    '⚽', '🏈', '🏀', '🏐', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏',
    '🎯', '🎳', '🥇', '🥈', '🥉', '🏆', '🏅', '🎖️', '⭐', '✨',
    '💯', '🔥', '💪', '👏', '🙌', '👍', '👎', '✊', '👊', '🤝',
    '❤️', '💙', '💚', '💛', '🧡', '💜', '🖤', '🤍', '🤎', '💗'
  ];

  if (!isOpen) return null;

  return (
    <div className="emoji-picker-overlay" onClick={onClose}>
      <div className="emoji-picker" onClick={(e) => e.stopPropagation()}>
        <div className="emoji-picker-header">
          <span>اختر رمز تعبيري</span>
          <button className="emoji-picker-close" onClick={onClose}>×</button>
        </div>
        <div className="emoji-grid">
          {emojis.map((emoji, index) => (
            <button
              key={index}
              className="emoji-button"
              onClick={() => {
                onEmojiSelect(emoji);
                onClose();
              }}
            >
              {emoji}
            </button>
          ))}
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
    "Tell me about the rivalry between Al Ahly SC and Zamalek SC.",
    "How many UEFA Champions League titles has Real Madrid won, and in which years?",
    "Which teams have won both the FIFA World Cup and the UEFA European Championship?",
    "What's the difference between the CAF Champions League and the FIFA Club World Cup?",
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

  const handlePrompt = (promptText) => {
    const msg: Message = {
      id: crypto.randomUUID(),
      content: promptText,
      role: "user",
    };
    append(msg);
  };

  const { append, isLoading, messages, input, handleInputChange, handleSubmit, setInput } =
    useChat();
  const noMessages = !messages || messages.length === 0;

  // إرسال الرسالة عند الضغط Enter (مع دعم Shift+Enter لسطر جديد)
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() !== "") handleSubmit(e);
    }
  };

  const handleEmojiSelect = (emoji) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText = input.slice(0, start) + emoji + input.slice(end);
      setInput(newText);
      
      // إعادة تركيز المؤشر بعد إضافة الإيموجي
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 0);
    }
  };

  return (
    <div className="Chatbot-popup">
      <div className="chat-header">
        <div className="header-info">
          <img src="/ChatGPT.png" className="chatbot-logo" alt="Bot" />
          <span className="logo-text">Chatbot</span>
        </div>
      </div>
      <div className="chat-body">
        {noMessages ? (
          <>
            <Bubble message={{
              content: "The ultimate place for football super fans! Ask FootyGPT anything about the fantastic world of football and it will come back with the most up-to-date answers.",
              role: "assistant"
            }} />
            <PromptSuggestionsRow onPromptClick={handlePrompt} />
          </>
        ) : (
          <>
            {messages.map((message, index) => (
              <Bubble key={`message-${index}`} message={message} />
            ))}
            {isLoading && <LoadingBubble />}
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
            placeholder="Ask me something..."
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
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M3 21L21 12L3 3V10L17 12L3 14V21Z" fill="currentColor"/>
              </svg>
            </button>
          </div>
        </form>
      </div>
      
      <EmojiPicker 
        isOpen={showEmojiPicker}
        onEmojiSelect={handleEmojiSelect}
        onClose={() => setShowEmojiPicker(false)}
      />
    </div>
  );
};

export default Home;