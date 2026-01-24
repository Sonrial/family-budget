'use client'
import { useEffect, useState, use } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Save, Trash2 } from 'lucide-react'
import Link from 'next/link'

export default function DetalleMovimientoPage({ params }: { params: Promise<{ id: string }> }) {
  const [txId, setTxId] = useState<string>('')
  
  useEffect(() => { params.then(p => setTxId(p.id)) }, [params])

  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [tx, setTx] = useState<any>(null)
  const [notes, setNotes] = useState('')
  const [amount, setAmount] = useState('') // Texto con puntos

  useEffect(() => {
    if (!txId) return
    const fetchTx = async () => {
      const { data, error } = await supabase.from('transactions').select('*, transaction_lines(*)').eq('id', txId).single()
      
      if (error) { alert('No se encontró'); router.push('/dashboard'); return }
      
      setTx(data)
      setNotes(data.notes || '')
      
      const positiveLine = data.transaction_lines.find((l: any) => l.amount > 0)
      if (positiveLine) {
        // Al cargar, convertimos el número de BD (3000) a texto con puntos ("3.000")
        const formatted = new Intl.NumberFormat('es-CO').format(positiveLine.amount)
        setAmount(formatted)
      }
      
      setLoading(false)
    }
    fetchTx()
  }, [txId])

  // Lógica de formato al escribir
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '')
    if (!rawValue) { setAmount(''); return }
    const formatted = new Intl.NumberFormat('es-CO').format(parseInt(rawValue))
    setAmount(formatted)
  }

  const handleUpdate = async () => {
    setSaving(true)
    // Limpiamos puntos antes de guardar
    const cleanAmount = amount.replace(/\./g, '')
    const newAmount = parseFloat(cleanAmount)
    
    if (!newAmount || newAmount <= 0) return alert("Monto inválido")

    await supabase.from('transactions').update({ notes }).eq('id', txId)

    const { data: lines } = await supabase.from('transaction_lines').select('*').eq('transaction_id', txId)
    if (lines) {
        for (const line of lines) {
            const updatedAmount = line.amount > 0 ? newAmount : -newAmount
            await supabase.from('transaction_lines').update({ amount: updatedAmount }).eq('id', line.id)
        }
    }
    setSaving(false)
    router.push('/dashboard')
  }
  
  const handleDelete = async () => {
      if(!confirm("¿Eliminar este movimiento permanentemente? Se ajustarán los saldos.")) return
      await supabase.from('transactions').delete().eq('id', txId)
      router.push('/dashboard')
  }

  if (loading) return <div className="p-10 text-center">Cargando detalle...</div>

  return (
    <div className="max-w-md mx-auto py-6">
       <Link href="/dashboard" className="flex items-center text-sm text-gray-500 mb-4 hover:text-blue-600">
        <ArrowLeft className="w-4 h-4 mr-1" /> Volver
      </Link>

      <Card>
        <CardHeader className={`${tx.type === 'INGRESO' ? 'bg-green-50' : 'bg-red-50'} rounded-t-lg`}>
            <CardTitle className="text-center">
                {tx.type === 'INGRESO' ? '📈 Ingreso' : '📉 Gasto'}
            </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
            <div className="space-y-1">
                <Label>Descripción</Label>
                <div className="font-bold text-lg">{tx.description}</div>
                <div className="text-xs text-gray-500">{new Date(tx.date).toLocaleDateString()}</div>
            </div>

            <div className="space-y-2">
                <Label>Monto (Editable)</Label>
                {/* Input de Texto con Formato */}
                <Input 
                    type="text" 
                    value={amount} 
                    onChange={handleAmountChange} 
                    className="text-xl font-mono" // Sin font-bold
                />
            </div>

            <div className="space-y-2">
                <Label>Notas / Detalles (Editable)</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} className="min-h-[100px]" />
            </div>

            <div className="flex gap-3 pt-4">
                <Button onClick={handleUpdate} disabled={saving} className="flex-1 bg-blue-700 hover:bg-blue-800">
                    <Save className="w-4 h-4 mr-2"/> {saving ? 'Guardando...' : 'Guardar Cambios'}
                </Button>
                <Button onClick={handleDelete} variant="destructive" size="icon">
                    <Trash2 className="w-4 h-4" />
                </Button>
            </div>
        </CardContent>
      </Card>
    </div>
  )
}