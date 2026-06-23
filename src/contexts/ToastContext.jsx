import { createContext, useCallback, useContext, useState } from 'react'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

let idCounter = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const remove = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const push = useCallback((message, type = 'info') => {
    const id = ++idCounter
    setToasts((t) => [...t, { id, message, type }])
    setTimeout(() => remove(id), 4500)
  }, [remove])

  const value = {
    success: (m) => push(m, 'success'),
    error: (m) => push(m, 'error'),
    info: (m) => push(m, 'info'),
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-start gap-3 p-3 rounded-lg shadow-lg border bg-white animate-slide-in ${
              t.type === 'success' ? 'border-emerald-200' :
              t.type === 'error' ? 'border-red-200' : 'border-blue-200'
            }`}
          >
            {t.type === 'success' && <CheckCircle2 className="text-emerald-500 shrink-0" size={20} />}
            {t.type === 'error' && <XCircle className="text-red-500 shrink-0" size={20} />}
            {t.type === 'info' && <Info className="text-blue-500 shrink-0" size={20} />}
            <p className="text-sm text-slate-700 flex-1">{t.message}</p>
            <button onClick={() => remove(t.id)} className="text-slate-400 hover:text-slate-600">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast doit être utilisé dans un ToastProvider')
  return ctx
}
