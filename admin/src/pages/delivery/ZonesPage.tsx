import { Button, Form, Input, InputNumber, message, Modal, Space, Switch, Table } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../../lib/api'

const fetchZones = async () => (await api.get('/admin/delivery_zones')).data

export const ZonesPage = () => {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['zones'], queryFn: fetchZones })
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form] = Form.useForm()

  const save = useMutation({
    mutationFn: async (values: any) => {
      if (editing) return api.put(`/admin/delivery_zones/${editing.id}`, values)
      return api.post('/admin/delivery_zones', values)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['zones'] })
      message.success('Зона сохранена')
      setOpen(false)
      setEditing(null)
      form.resetFields()
    },
    onError: (err: any) => {
      console.error(err)
      message.error(err.response?.data?.detail || 'Ошибка при сохранении')
    },
  })

  const remove = useMutation({
    mutationFn: async (id: number) => api.delete(`/admin/delivery_zones/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['zones'] }),
  })

  const columns = [
    { title: 'ID', dataIndex: 'id' },
    { title: 'Город', dataIndex: 'city' },
    {
      title: 'Полигон',
      dataIndex: 'polygon',
      render: (polygon: any) => {
        if (!polygon) return '-'
        return `${polygon.length} точек`
      },
    },
    { title: 'Стоимость', dataIndex: 'delivery_fee' },
    { title: 'SLA (мин)', dataIndex: 'sla_minutes' },
    { title: 'Сортировка', dataIndex: 'sort_order' },
    { title: 'Активна', dataIndex: 'is_active', render: (v: boolean) => (v ? 'Да' : 'Нет') },
    {
      title: 'Действия',
      render: (_: any, record: any) => (
        <Space>
          <Button
            size="small"
            onClick={() => {
              setEditing(record)
      form.setFieldsValue({
        ...record,
        polygon: record.polygon ? JSON.stringify(record.polygon) : undefined,
      })
              setOpen(true)
            }}
          >
            Редактировать
          </Button>
          <Button danger size="small" onClick={() => remove.mutate(record.id)}>
            Удалить
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <>
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" onClick={() => setOpen(true)}>
          Новая зона
        </Button>
      </Space>
      <Table loading={isLoading} dataSource={data || []} columns={columns} rowKey="id" />

      <Modal
        open={open}
        title={editing ? 'Редактировать зону' : 'Новая зона'}
        onCancel={() => {
          setOpen(false)
          setEditing(null)
        }}
        onOk={() => form.submit()}
        confirmLoading={save.isPending}
      >
        <Form
          layout="vertical"
          form={form}
          initialValues={{ is_active: true, sort_order: 0, sla_minutes: 180 }}
          onFinish={(values) => {
            try {
              const payload = { ...values }
              if (payload.polygon) {
                let raw = typeof payload.polygon === 'string' ? payload.polygon.trim() : payload.polygon
                // Remove leading | if user accidentally included it
                if (typeof raw === 'string' && raw.startsWith('|')) {
                  raw = raw.substring(1).trim()
                }
                
                let normalized = typeof raw === 'string' ? JSON.parse(raw) : raw
                
                // Handle GeoJSON format: if it's [[[...]]], take the first element
                if (Array.isArray(normalized) && normalized.length > 0 && Array.isArray(normalized[0]) && normalized[0].length > 0 && Array.isArray(normalized[0][0])) {
                  normalized = normalized[0]
                }

                if (!Array.isArray(normalized)) {
                  throw new Error('Полигон должен быть массивом')
                }
                payload.polygon = normalized
              }
              save.mutate(payload)
            } catch (error: any) {
              message.error(error.message || 'Неверный формат полигона')
            }
          }}
        >
          <Form.Item name="city" label="Город" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="delivery_fee" label="Стоимость доставки" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="sla_minutes" label="SLA (мин)">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="min_order_total" label="Мин. сумма заказа">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="polygon" label="Полигон (JSON)" rules={[{ required: true, message: 'Введите координаты полигона' }]}>
            <Input.TextArea
              rows={3}
              placeholder="[[37.71,55.88],[37.69,55.89],...]"
            />
          </Form.Item>
          <Form.Item name="sort_order" label="Порядок сортировки">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="is_active" label="Активна" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}


