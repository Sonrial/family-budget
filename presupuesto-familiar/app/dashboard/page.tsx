// Ruta: app/dashboard/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function Dashboard() {
  const supabase = createClient()
  const [scope, setScope] = useState<'PERSONAL' | 'SHARED'>('PERSONAL')
  const [accounts, setAccounts] = useState<any[]>([])
  const [recentTx, setRecentTx] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    
    let query = supabase.from('accounts').select('*').eq('scope', scope)
    if (scope === 'PERSONAL' && user) {
      query = query.eq('user_id', user.id)
    }

    const { data: accData } = await query
    
    const { data: txData } = await supabase
      .from('transactions')
      .select('*, created_by_profile:profiles(email)')
      .eq('scope', scope)
      .order('date', { ascending: false })
      .limit(10)

    setAccounts(accData || [])
    setRecentTx(txData || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [scope])

  const activos = accounts.filter(a => a.type === 'ASSET')

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">
          Visión {scope === 'PERSONAL' ? 'Personal' : 'Familiar (Fondo Común)'}
        </h2>
        <div className="bg-white p-1 rounded-lg border shadow-sm">
          <button 
            onClick={() => setScope('PERSONAL')}
            className={`px-4 py-2 rounded-md transition ${scope === 'PERSONAL' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}
          >
            Personal
          </button>
          <button 
            onClick={() => setScope('SHARED')}
            className={`px-4 py-2 rounded-md transition ${scope === 'SHARED' ? 'bg-green-600 text-white' : 'text-gray-600'}`}
          >
            Familiar
          </button>
        </div>
      </div>

      {loading ? <p>Cargando datos...</p> : (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border">
            <h3 className="text-lg font-semibold mb-4 text-gray-700">Cuentas Disponibles</h3>
            <div className="space-y-3">
              {activos.length === 0 && <p className="text-gray-400">No hay cuentas configuradas.</p>}
              {activos.map(acc => (
                <div key={acc.id} className="flex justify-between p-3 bg-gray-50 rounded border">
                  <span>{acc.icon} {acc.name}</span>
                  <span className="font-bold text-blue-600">Ver Detalles</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border">
            <h3 className="text-lg font-semibold mb-4 text-gray-700">Últimos Movimientos</h3>
            <div className="space-y-3">
              {recentTx.length === 0 && <p className="text-gray-400">Sin movimientos recientes.</p>}
              {recentTx.map(tx => (
                <div key={tx.id} className="border-b pb-2">
                  <div className="flex justify-between">
                    <span className="font-medium">{tx.description}</span>
                    <span className="text-xs text-gray-500">{tx.date}</span>
                  </div>
                  <div className="text-xs text-gray-400">
                    Por: {tx.created_by_profile?.email}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}