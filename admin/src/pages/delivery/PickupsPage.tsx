import { Button, Form, Input, InputNumber, Modal, Space, Switch, Table, message, Typography, Row, Col } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../../lib/api'

interface PickupLocation {
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

const fetchPickups = async (): Promise<PickupLocation[]> => {
  const res = await api.get('/admin/store_locations')
  return res.data
}

export const PickupsPage = () => {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['store_locations'], queryFn: fetchPickups })
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PickupLocation | null>(null)
  const [form] = Form.useForm()

  const createMutation = useMutation({
    mutationFn: async (values: any) => api.post('/admin/store_locations', values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['store_locations'] })
      message.success('Пункт самовывоза создан')
      setOpen(false)
      form.resetFields()
    },
    onError: () => message.error('Ошибка при создании'),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: number; values: any }) =>
      api.put(`/admin/store_locations/${id}`, values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['store_locations'] })
      message.success('Пункт самовывоза обновлён')
      setOpen(false)
      setEditing(null)
      form.resetFields()
    },
    onError: () => message.error('Ошибка при обновлении'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/admin/store_locations/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['store_locations'] })
      message.success('Пункт самовывоза удалён')
    },
    onError: () => message.error('Ошибка при удалении'),
  })

  const handleCreate = () => {
    setEditing(null)
    form.resetFields()
    setOpen(true)
  }

  const handleEdit = (record: PickupLocation) => {
    setEditing(record)
    form.setFieldsValue(record)
    setOpen(true)
  }

  const handleSubmit = (values: any) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, values })
    } else {
      createMutation.mutate(values)
    }
  }

  const handleDelete = (id: number) => {
    if (window.confirm('Удалить этот пункт самовывоза?')) {
      deleteMutation.mutate(id)
    }
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: 'Город', dataIndex: 'city', width: 120 },
    { title: 'Адрес', dataIndex: 'address_text', ellipsis: true },
    {
      title: 'Координаты',
      width: 180,
      render: (_: any, record: PickupLocation) =>
        record.lat && record.lng
          ? <Typography.Text type="secondary" style={{ fontSize: 12 }}>{record.lat.toFixed(6)}, {record.lng.toFixed(6)}</Typography.Text>
          : <Typography.Text type="warning">Не указаны</Typography.Text>
    },
    { title: 'Телефон', dataIndex: 'phone', width: 150 },
    { title: 'Часы работы', dataIndex: 'working_hours', width: 150, ellipsis: true },
    {
      title: 'Активен',
      dataIndex: 'is_active',
      width: 80,
      render: (active: boolean) => <Switch checked={active} disabled size="small" />,
    },
    {
      title: 'Действия',
      width: 150,
      render: (_: any, record: PickupLocation) => (
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
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography.Title level={4} style={{ margin: 0 }}>Пункты самовывоза</Typography.Title>
          <Button type="primary" onClick={handleCreate}>
            Добавить пункт
          </Button>
        </div>

        <Typography.Text type="secondary">
          Управление адресами пунктов самовывоза. Координаты используются для отображения на карте в приложении.
        </Typography.Text>

        <Table
          loading={isLoading}
          dataSource={data || []}
          columns={columns}
          rowKey="id"
          pagination={false}
          size="middle"
        />
      </Space>

      <Modal
        title={editing ? 'Редактировать пункт самовывоза' : 'Новый пункт самовывоза'}
        open={open}
        onCancel={() => {
          setOpen(false)
          setEditing(null)
          form.resetFields()
        }}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        okText="Сохранить"
        cancelText="Отмена"
        width={650}
      >
        <Form
          layout="vertical"
          form={form}
          initialValues={{ is_active: true, sort_order: 0 }}
          onFinish={handleSubmit}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="city" label="Город" rules={[{ required: true, message: 'Введите город' }]}>
                <Input placeholder="Москва" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label="Телефон">
                <Input placeholder="+7 (495) 123-45-67" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="address_text"
            label="Адрес"
            rules={[{ required: true, message: 'Введите адрес' }]}
          >
            <Input.TextArea rows={2} placeholder="ул. Тверская, д. 1" />
          </Form.Item>

          <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
            Координаты для отображения на карте (можно получить из Яндекс.Карт)
          </Typography.Text>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="lat" label="Широта (latitude)">
                <InputNumber
                  placeholder="55.755826"
                  style={{ width: '100%' }}
                  step={0.000001}
                  precision={6}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="lng" label="Долгота (longitude)">
                <InputNumber
                  placeholder="37.617300"
                  style={{ width: '100%' }}
                  step={0.000001}
                  precision={6}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="working_hours" label="Часы работы">
            <Input placeholder="Пн-Вс: 9:00 - 21:00" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="sort_order" label="Порядок сортировки">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="is_active" label="Активен" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </>
  )
}
