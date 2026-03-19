import { Button, Form, Input, InputNumber, Modal, Space, Switch, Table, message } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../../lib/api'

interface StoreLocation {
  id: number
  city: string
  address_text: string
  lat: number | null
  lng: number | null
  phone: string | null
  working_hours: string | null
  sort_order: number
  is_active: boolean
}

const fetchLocations = async (): Promise<StoreLocation[]> => {
  const res = await api.get('/admin/store_locations')
  return res.data
}

export const StoreLocationsPage = () => {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['store_locations'], queryFn: fetchLocations })
  
  const [modalVisible, setModalVisible] = useState(false)
  const [editingLocation, setEditingLocation] = useState<StoreLocation | null>(null)
  const [form] = Form.useForm()

  const createMutation = useMutation({
    mutationFn: async (values: any) => api.post('/admin/store_locations', values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['store_locations'] })
      message.success('Адрес создан')
      setModalVisible(false)
      form.resetFields()
    },
    onError: () => message.error('Ошибка при создании'),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: number; values: any }) =>
      api.put(`/admin/store_locations/${id}`, values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['store_locations'] })
      message.success('Адрес обновлён')
      setModalVisible(false)
      setEditingLocation(null)
      form.resetFields()
    },
    onError: () => message.error('Ошибка при обновлении'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/admin/store_locations/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['store_locations'] })
      message.success('Адрес удалён')
    },
    onError: () => message.error('Ошибка при удалении'),
  })

  const handleCreate = () => {
    setEditingLocation(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEdit = (location: StoreLocation) => {
    setEditingLocation(location)
    form.setFieldsValue(location)
    setModalVisible(true)
  }

  const handleSubmit = (values: any) => {
    if (editingLocation) {
      updateMutation.mutate({ id: editingLocation.id, values })
    } else {
      createMutation.mutate(values)
    }
  }

  const handleDelete = (id: number) => {
    if (window.confirm('Удалить этот адрес?')) {
      deleteMutation.mutate(id)
    }
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: 'Город', dataIndex: 'city', width: 120 },
    { title: 'Адрес', dataIndex: 'address_text' },
    { title: 'Телефон', dataIndex: 'phone', width: 150 },
    { title: 'Часы работы', dataIndex: 'working_hours', width: 200 },
    {
      title: 'Активен',
      dataIndex: 'is_active',
      width: 90,
      render: (active: boolean) => <Switch checked={active} disabled />,
    },
    {
      title: 'Действия',
      width: 160,
      render: (_: any, record: StoreLocation) => (
        <Space>
          <Button type="link" size="small" onClick={() => handleEdit(record)}>
            Изменить
          </Button>
          <Button type="link" size="small" danger onClick={() => handleDelete(record.id)}>
            Удалить
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Button type="primary" onClick={handleCreate}>
          Добавить адрес
        </Button>

        <Table
          loading={isLoading}
          dataSource={data || []}
          columns={columns}
          rowKey="id"
          pagination={false}
        />
      </Space>

      <Modal
        title={editingLocation ? 'Редактировать адрес' : 'Добавить адрес'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false)
          setEditingLocation(null)
          form.resetFields()
        }}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        okText="Сохранить"
        cancelText="Отмена"
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ sort_order: 0, is_active: true }}
        >
          <Form.Item name="city" label="Город" rules={[{ required: true, message: 'Введите город' }]}>
            <Input placeholder="Москва" />
          </Form.Item>

          <Form.Item
            name="address_text"
            label="Адрес"
            rules={[{ required: true, message: 'Введите адрес' }]}
          >
            <Input.TextArea rows={2} placeholder="Средняя Первомайская, 25с1" />
          </Form.Item>

          <Space style={{ width: '100%' }} size="middle">
            <Form.Item name="lat" label="Широта">
              <InputNumber placeholder="55.755826" style={{ width: 150 }} step={0.000001} />
            </Form.Item>

            <Form.Item name="lng" label="Долгота">
              <InputNumber placeholder="37.617300" style={{ width: 150 }} step={0.000001} />
            </Form.Item>
          </Space>

          <Form.Item name="phone" label="Телефон">
            <Input placeholder="+7 (495) 123-45-67" />
          </Form.Item>

          <Form.Item name="working_hours" label="Часы работы">
            <Input placeholder="Пн-Вс: 9:00 - 21:00" />
          </Form.Item>

          <Form.Item name="sort_order" label="Порядок сортировки">
            <InputNumber min={0} />
          </Form.Item>

          <Form.Item name="is_active" label="Активен" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

