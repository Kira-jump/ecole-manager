import { Inbox } from 'lucide-react'

export default function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  return (
    <div className="text-center py-12 px-4">
      <div className="mx-auto w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
        <Icon className="text-slate-400" size={28} />
      </div>
      <h3 className="mt-4 text-sm font-medium text-slate-900">{title}</h3>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
