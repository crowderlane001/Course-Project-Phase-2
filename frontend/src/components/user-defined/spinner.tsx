//This file contains code for a spinner.

import '@/animations.css';

function Spinner() {
    const animationStyle = {
        animation: "spin 1s cubic-bezier(.94,.01,.17,1.02) infinite"
    }

    return (
        <div>
            <div className="w-10 h-10 border-4 border-t-transparent border-l-transparent border-gray-900 rounded-full" style={animationStyle}></div>
        </div>
    )
}

export default Spinner;