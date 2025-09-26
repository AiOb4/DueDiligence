import './chatStyles.css';

export default function Message({sender, answer}) {
    return (
        <div className = {`message ${sender === 'AI' ? "ai" : "user"}`}>
            <div className = 'text-box'>{sender}: {answer}</div>
        </div>
    )
}