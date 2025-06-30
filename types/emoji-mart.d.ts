interface EmojiMart {
    Picker: new (options: {
      theme?: string;
      skinTonePosition?: string;
      previewPosition?: string;
      onEmojiSelect?: (emoji: { native: string }) => void;
      locale?: string;
      set?: string;
      showPreview?: boolean;
      showSkinTones?: boolean;
      style?: {
        width?: string;
        height?: string;
      };
    }) => HTMLElement;
  }
  
  declare global {
    interface Window {
      EmojiMart: EmojiMart;
    }
  }
  export {}; 