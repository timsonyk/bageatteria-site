import { Button, Select, Space, Table, Tag } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'

const fetchOrders = async (status?: string) => {
  const res = await api.get('/admin/orders', { params: status ? { status } : {} })
  return res.data
}

const statuses = ['new', 'pending_payment', 'paid', 'in_progress', 'delivered', 'cancelled']
const statusLabels: Record<string, string> = {
  new: 'Новый',
  pending_payment: 'Ожидает оплаты',
  paid: 'Оплачен',
  in_progress: 'В работе',
  delivered: 'Доставлен',
  cancelled: 'Отменён',
}

export const OrdersPage = () => {
  const qc = useQueryClient()
  const [status, setStatus] = useState<string | undefined>(undefined)
  const { data, isLoading } = useQuery({ queryKey: ['orders', status], queryFn: () => fetchOrders(status) })

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) =>
      api.post(`/admin/orders/${id}/status`, null, { params: { status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  })

  const columns = [
    { title: 'ID', dataIndex: 'id' },
    { title: 'Пользователь', dataIndex: 'user_id' },
    { title: 'Сумма', dataIndex: 'total' },
    { title: 'Доставка', dataIndex: 'delivery_type' },
    { title: 'Создан', dataIndex: 'created_at' },
    { title: 'Статус', dataIndex: 'status', render: (v: string) => <Tag>{statusLabels[v] || v}</Tag> },
    {
      title: 'Действия',
      render: (_: any, record: any) => (
        <Space>
          <Link to={`/orders/${record.id}`}>Открыть</Link>
          {['paid', 'in_progress', 'delivered'].map((next) => (
            <Button
              key={next}
              size="small"
              onClick={() => updateStatus.mutate({ id: record.id, status: next })}
            >
              {statusLabels[next] || next}
            </Button>
          ))}
        </Space>
      ),
    },
  ]

  return (
    <>
      <Space style={{ marginBottom: 12 }}>
        <Select
          placeholder="Фильтр по статусу"
          allowClear
          value={status}
          onChange={setStatus}
          style={{ width: 200 }}
          options={statuses.map((s) => ({ value: s, label: statusLabels[s] || s }))}
        />
      </Space>
      <Table loading={isLoading} dataSource={data || []} columns={columns} rowKey="id" />
    </>
  )
}


