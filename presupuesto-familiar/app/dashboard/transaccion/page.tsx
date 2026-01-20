'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function NuevaTransaccion() {
  const supabase = createClient()
  const router = useRouter()
  
  // Estado del formulario
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState('GASTO') // GASTO, INGRESO, APORTE
  const [scope, setScope] = useState('PERSONAL')
  
  // Listas de cuentas para los selectores
  const [assets, setAssets] = useState<any[]>([]) // Cuentas de dinero
  const [categories, setCategories] = useState<any[]>([]) // Categorías de gasto/ingreso
  
  const [selectedAsset, setSelectedAsset] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')

  useEffect(() => {
    const loadAccounts = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Cargar cuentas según el scope seleccionado
      // Si es PERSONAL: Mis cuentas. Si es SHARED: Cuentas del hogar.
      let query = supabase.from('accounts').select('*').eq('scope', scope)
      
      if (scope === 'PERSONAL') {
        query = query.eq('user_id', user.id)
      }
      
      const { data } = await query
      if (data) {
        setAssets(data.filter(a => a.type === 'ASSET'))
        setCategories(data.filter(a => a.type === (type === 'INGRESO' ? 'INCOME' : 'EXPENSE')))
      }
    }
    loadAccounts()
  }, [scope, type])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const val = parseFloat(amount)
    if (!val || !selectedAsset || (!selectedCategory && type !== 'APORTE')) {
        alert('Completa todos los campos'); return;
    }

    // 1. Crear Cabecera de Transacción
    const { data: tx, error: txError } = await supabase.from('transactions').insert({
      description,
      scope,
      date: new Date().toISOString(),
      created_by: user.id
    }).select().single()

    if (txError) { alert('Error creando TX'); return }

    // 2. Crear Líneas Contables (Partida Doble)
    const lines = []

    if (type === 'GASTO') {
      // GASTO: Debito al Gasto (+), Crédito al Activo (-)
      lines.push({ transaction_id: tx.id, account_id: selectedCategory, amount: val }) // Gasto aumenta
      lines.push({ transaction_id: tx.id, account_id: selectedAsset, amount: -val })   // Dinero disminuye
    } else if (type === 'INGRESO') {
      // INGRESO: Debito al Activo (+), Crédito al Ingreso (-)
      lines.push({ transaction_id: tx.id, account_id: selectedAsset, amount: val })    // Dinero aumenta
      lines.push({ transaction_id: tx.id, account_id: selectedCategory, amount: -val }) // Ingreso (Naturaleza Crédito)
    } else if (type === 'APORTE') {
        // LÓGICA ESPECIAL: De Personal a Shared
        // Esto requeriría una transacción compleja cruzada, 
        // Para el MVP, lo simplificamos registrándolo en Shared como Ingreso de Aporte
        // y el usuario debería registrar manualmente su salida personal.
        // Ojo: En V2 automatizaremos esto. Por ahora, regístralo como INGRESO al fondo común.
    }

    const { error: linesError } = await supabase.from('transaction_lines').insert(lines)
    
    if (linesError) alert('Error en líneas contables')
    else router.push('/dashboard')
  }

  return (
    <div className="max-w-lg mx-auto bg-white p-8 rounded shadow">
      <h2 className="text-xl font-bold mb-4">Registrar Movimiento</h2>
      
      <div className="mb-4 flex gap-4">
        <label className="flex items-center gap-2">
          <input type="radio" checked={scope === 'PERSONAL'} onChange={() => setScope('PERSONAL')} />
          Personal
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={scope === 'SHARED'} onChange={() => setScope('SHARED')} />
          Familiar (Fondo Común)
        </label>
      </div>

      <div className="mb-4 flex gap-2">
        <button type="button" onClick={() => setType('GASTO')} 
          className={`flex-1 p-2 rounded ${type === 'GASTO' ? 'bg-red-100 border-red-500 border' : 'bg-gray-100'}`}>
          Gasto 📉
        </button>
        <button type="button" onClick={() => setType('INGRESO')} 
          className={`flex-1 p-2 rounded ${type === 'INGRESO' ? 'bg-green-100 border-green-500 border' : 'bg-gray-100'}`}>
          Ingreso 📈
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input 
          type="text" placeholder="Descripción (ej. Mercado Éxito)" 
          className="w-full p-2 border rounded"
          value={description} onChange={e => setDescription(e.target.value)}
        />
        <input 
          type="number" placeholder="Monto (COP)" 
          className="w-full p-2 border rounded"
          value={amount} onChange={e => setAmount(e.target.value)}
        />

        <select 
          className="w-full p-2 border rounded"
          value={selectedAsset} onChange={e => setSelectedAsset(e.target.value)}
        >
          <option value="">-- Selecciona cuenta de pago (Banco/Efectivo) --</option>
          {assets.map(a => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
        </select>

        <select 
          className="w-full p-2 border rounded"
          value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}
        >
          <option value="">-- Selecciona Categoría --</option>
          {categories.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>

        <button className="w-full bg-blue-600 text-white py-3 rounded hover:bg-blue-700">
          Guardar Movimiento
        </button>
      </form>
    </div>
  )
}