import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center mb-8">
          Toodle - List Manager
        </h1>
        <div className="max-w-md mx-auto bg-card rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">MVP Setup Complete</h2>
          <p className="text-muted-foreground mb-4">
            Phase 3.1 project setup is ready. Click the button to test React state:
          </p>
          <button
            className="w-full bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors touch-manipulation"
            onClick={() => setCount((count) => count + 1)}
          >
            Count is {count}
          </button>
          <p className="text-xs text-muted-foreground mt-4 text-center">
            Mobile-first PWA with React + TypeScript + Tailwind v4 + Supabase
          </p>
        </div>
      </div>
    </div>
  )
}

export default App