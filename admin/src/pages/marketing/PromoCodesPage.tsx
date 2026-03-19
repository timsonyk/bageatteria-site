import { Button, DatePicker, Form, Input, InputNumber, Modal, Select, Space, Switch, Table } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import dayjs from 'dayjs'
import { api } from '../../lib/api'

const fetchPromo = async () => (await api.get('/admin/promo_codes')).data

export const PromoCodesPage = () => {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['promo_codes'], queryFn: fetchPromo })
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form] = Form.useForm()

  const save = useMutation({
    mutationFn: async (values: any) => {
      const payload = {
        ...values,
        starts_at: values.starts_at ? values.starts_at.toISOString() : null,
        ends_at: values.ends_at ? values.ends_at.toISOString() : null,
      }
      if (editing) return api.put(`/admin/promo_codes/${editing.id}`, payload)
      return api.post('/admin/promo_codes', payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['promo_codes'] })
      setOpen(false)
      setEditing(null)
      form.resetFields()
    },
  })

  const remove = useMutation({
    mutationFn: async (id: number) => api.delete(`/admin/promo_codes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['promo_codes'] }),
  })

  const columns = [
    { title: 'Код', dataIndex: 'code' },
    { title: 'Тип', dataIndex: 'discount_type' },
    { title: 'Значение', dataIndex: 'discount_value' },
    { title: 'Активен', dataIndex: 'is_active', render: (v: boolean) => (v ? 'Да' : 'Нет') },
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
                starts_at: record.starts_at ? dayjs(record.starts_at) : null,
                ends_at: record.ends_at ? dayjs(record.ends_at) : null,
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
          Новый промокод
        </Button>
      </Space>
      <Table loading={isLoading} dataSource={data || []} columns={columns} rowKey="id" />

      <Modal
        open={open}
        title={editing ? 'Редактировать промокод' : 'Новый промокод'}
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
          initialValues={{ is_active: true, discount_type: 'percent' }}
          onFinish={(values) => save.mutate(values)}
        >
          <Form.Item name="code" label="Код" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="discount_type" label="Тип" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'percent', label: 'Процент' },
                { value: 'fixed', label: 'Фиксированная сумма' },
              ]}
            />
          </Form.Item>
          <Form.Item name="discount_value" label="Значение" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="min_order_total" label="Мин. сумма заказа">
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="usage_limit" label="Лимит использований">
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="starts_at" label="Начало">
            <DatePicker style={{ width: '100%' }} showTime />
          </Form.Item>
          <Form.Item name="ends_at" label="Окончание">
            <DatePicker style={{ width: '100%' }} showTime />
          </Form.Item>
          <Form.Item name="is_active" label="Активен" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}


