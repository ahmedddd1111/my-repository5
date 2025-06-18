import PromptSuggestionButton from "./PromptSuggestionButton";

const PromptSuggestionsRow =({onPromptClick}) => {
    const prompts = [
        "What are the most important types of cyber attacks?",
        "How can I protect my network from intruders?",
        "What are the best penetration testing tools?",
        "What is SQL Injection and how can I prevent it?"
    ];
    return (
        <div className="prompt-suggestion-row">
            {prompts.map((prompt , index)=> <PromptSuggestionButton key={`suggestion-${index}`} text={prompt} onClick={() => onPromptClick(prompt)}/>)}
        </div>
    )
}
export default PromptSuggestionsRow