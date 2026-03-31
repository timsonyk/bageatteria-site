import { useEffect, useState } from 'react'
import { Button, Drawer, Form, Input, Modal, Space, Switch, Table, Typography, message } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'

const fetchCategories = async () => {
  const res = await api.get('/admin/categories')
  return res.data
}

const fetchStoreLocations = async () => (await api.get('/admin/store_locations')).data
const fetchCategoryAvailability = async (categoryId: number) =>
  (await api.get('/admin/category_availability', { params: { category_id: categoryId } })).data

export const CategoriesPage = () => {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['categories'], queryFn: fetchCategories })
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form] = Form.useForm()

  // Store availability
  const [availabilityOpen, setAvailabilityOpen] = useState(false)
  const [availabilityCategoryId, setAvailabilityCategoryId] = useState<number | null>(null)
  const { data: storeLocations } = useQuery({ queryKey: ['store_locations'], queryFn: fetchStoreLocations })
  const availabilityQuery = useQuery({
    queryKey: ['category_availability', availabilityCategoryId],
    queryFn: () => fetchCategoryAvailability(availabilityCategoryId!),
    enabled: !!availabilityCategoryId,
  })
  const [selectedStores, setSelectedStores] = useState<number[]>([])

  const save = useMutation({
    mutationFn: async (values: any) => {
      if (editing) {
        return api.put(`/admin/categories/${editing.id}`, values)
      }
      return api.post('/admin/categories', values)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      setOpen(false)
      setEditing(null)
      form.resetFields()
    },
  })

  const remove = useMutation({
    mutationFn: async (id: number) => api.delete(`/admin/categories/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })

  const saveAvailability = useMutation({
    mutationFn: async (payload: { category_id: number; store_location_ids: number[] }) =>
      api.post('/admin/category_availability/bulk', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['category_availability', availabilityCategoryId] })
      message.success('Доступность сохранена')
      setAvailabilityOpen(false)
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.detail || 'Не удалось сохранить доступность')
    },
  })

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: 'Название', dataIndex: 'name' },
    { title: 'Сортировка', dataIndex: 'sort_order', width: 100 },
    {
      title: 'Активна',
      dataIndex: 'is_active',
      width: 80,
      render: (v: boolean, record: any) => (
        <Switch
          checked={v}
          size="small"
          onChange={(checked) => {
            api.put(`/admin/categories/${record.id}`, { ...record, is_active: checked }).then(() => {
              qc.invalidateQueries({ queryKey: ['categories'] })
            })
          }}
        />
      ),
    },
    {
      title: 'Действия',
      render: (_: any, record: any) => (
        <Space>
          <Button
            size="small"
            onClick={() => {
              setEditing(record)
              form.setFieldsValue(record)
              setOpen(true)
            }}
          >
            Редактировать
          </Button>
          <Button
            size="small"
            onClick={() => {
              setAvailabilityCategoryId(record.id)
              setAvailabilityOpen(true)
            }}
          >
            Точки
          </Button>
          <Button danger size="small" onClick={() => remove.mutate(record.id)}>
            Удалить
          </Button>
        </Space>
      ),
    },
  ]

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    setOpen(true)
  }

  // Load selected stores when opening availability drawer
  useEffect(() => {
    if (availabilityOpen && availabilityQuery.data) {
      setSelectedStores(availabilityQuery.data.map((a: any) => a.store_location_id))
    }
  }, [availabilityOpen, availabilityQuery.data])

  useEffect(() => {
    if (!availabilityOpen) {
      setAvailabilityCategoryId(null)
      setSelectedStores([])
    }
  }, [availabilityOpen])

  return (
    <>
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" onClick={openCreate}>
          Новая категория
        </Button>
      </Space>
      <Table loading={isLoading} dataSource={data || []} columns={columns} rowKey="id" />

      <Modal
        open={open}
        title={editing ? 'Редактировать категорию' : 'Новая категория'}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={save.isPending}
      >
        <Form
          layout="vertical"
          form={form}
          initialValues={{ is_active: true }}
          onFinish={(values) => save.mutate(values)}
        >
          <Form.Item name="name" label="Название" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="sort_order" label="Порядок сортировки" initialValue={0}>
            <Input type="number" />
          </Form.Item>
          <Form.Item name="is_active" label="Активна" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="Доступность на точках"
        open={availabilityOpen}
        onClose={() => setAvailabilityOpen(false)}
        destroyOnHidden
        extra={
          <Button
            type="primary"
            loading={saveAvailability.isPending}
            onClick={() => {
              if (availabilityCategoryId) {
                saveAvailability.mutate({
                  category_id: availabilityCategoryId,
                  store_location_ids: selectedStores,
                })
              }
            }}
          >
            Сохранить
          </Button>
        }
      >
        {availabilityQuery.isLoading ? (
          <Typography.Text>Загрузка...</Typography.Text>
        ) : (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Typography.Text type="secondary">
              Выберите точки, на которых доступна категория:
            </Typography.Text>
            {(storeLocations || []).map((store: any) => (
              <div
                key={store.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  border: '1px solid #d9d9d9',
                  borderRadius: 6,
                }}
              >
                <div>
                  <Typography.Text strong>{store.name}</Typography.Text>
                  <br />
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {store.address_text}
                  </Typography.Text>
                </div>
                <Switch
                  checked={selectedStores.includes(store.id)}
                  onChange={(checked) => {
                    if (checked) {
                      setSelectedStores([...selectedStores, store.id])
                    } else {
                      setSelectedStores(selectedStores.filter((id) => id !== store.id))
                    }
                  }}
                />
              </div>
            ))}
          </Space>
        )}
      </Drawer>
    </>
  )
}

