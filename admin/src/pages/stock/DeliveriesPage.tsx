import { Button, Table, Tag, Space, Select, DatePicker, Card, Typography, Modal, Form, Input, InputNumber } from 'antd'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../../lib/api'
import { useSearchParams, Link } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  PlusOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  CameraOutlined,
} from '@ant-design/icons'

const { Title } = Typography
const { RangePicker } = DatePicker

interface Delivery {
  id: number
  store_location_id: number
  store_location_name: string
  delivery_number: string | null
  supplier_name: string | null
  expected_date: string | null
  actual_date: string | null
  status: string
  received_by_name: string | null
  lines_count: number
  photos_count: number
  has_discrepancies: boolean
  created_at: string
}

interface StoreLocation {
  id: number
  name: string
}

interface StockItem {
  id: number
  name: string
  stock_category_id: number
}

const fetchDeliveries = async (params: any): Promise<Delivery[]> => {
  const res = await api.get('/admin/stock/deliveries', { params })
  return res.data
}

const fetchLocations = async (): Promise<StoreLocation[]> => {
  const res = await api.get('/admin/store-locations')
  return res.data
}

const fetchStockItems = async (): Promise<StockItem[]> => {
  const res = await api.get('/admin/stock/items')
  return res.data
}

const getStatusTag = (status: string, hasDiscrepancies: boolean) => {
  if (status === 'has_discrepancy' || hasDiscrepancies) {
    return <Tag color="red" icon={<ExclamationCircleOutlined />}>Расхождения</Tag>
  }
  switch (status) {
    case 'pending':
      return <Tag color="orange" icon={<ClockCircleOutlined />}>Ожидает</Tag>
    case 'in_progress':
      return <Tag color="blue">В процессе</Tag>
    case 'completed':
      return <Tag color="green" icon={<CheckCircleOutlined />}>Завершена</Tag>
    default:
      return <Tag>{status}</Tag>
  }
}

export const DeliveriesPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [form] = Form.useForm()
  const [selectedLocation, setSelectedLocation] = useState<number | undefined>(
    searchParams.get('location') ? Number(searchParams.get('location')) : undefined
  )
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>(
    searchParams.get('status') || undefined
  )

  const { data: deliveries, isLoading } = useQuery({
    queryKey: ['deliveries', selectedLocation, selectedStatus],
    queryFn: () => fetchDeliveries({
      store_location_id: selectedLocation,
      status: selectedStatus,
    }),
  })

  const { data: locations } = useQuery({
    queryKey: ['store-locations'],
    queryFn: fetchLocations,
  })

  const { data: stockItems } = useQuery({
    queryKey: ['stock-items'],
    queryFn: fetchStockItems,
  })

  const createMutation = useMutation({
    mutationFn: async (values: any) => {
      return api.post('/admin/stock/deliveries', values)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deliveries'] })
      setCreateOpen(false)
      form.resetFields()
    },
  })

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
    },
    {
      title: 'Точка',
      dataIndex: 'store_location_name',
      key: 'location',
    },
    {
      title: '№ накладной',
      dataIndex: 'delivery_number',
      key: 'number',
      render: (v: string | null) => v || '-',
    },
    {
      title: 'Поставщик',
      dataIndex: 'supplier_name',
      key: 'supplier',
      render: (v: string | null) => v || '-',
    },
    {
      title: 'Статус',
      key: 'status',
      render: (_: any, record: Delivery) => getStatusTag(record.status, record.has_discrepancies),
    },
    {
      title: 'Позиций',
      dataIndex: 'lines_count',
      key: 'lines',
    },
    {
      title: 'Фото',
      dataIndex: 'photos_count',
      key: 'photos',
      render: (count: number) => count > 0 ? <CameraOutlined /> : '-',
    },
    {
      title: 'Принял',
      dataIndex: 'received_by_name',
      key: 'received',
      render: (v: string | null) => v || '-',
    },
    {
      title: 'Дата',
      dataIndex: 'created_at',
      key: 'date',
      render: (v: string) => dayjs(v).format('DD.MM.YYYY HH:mm'),
    },
    {
      title: 'Действия',
      key: 'actions',
      render: (_: any, record: Delivery) => (
        <Link to={`/stock/deliveries/${record.id}`}>
          <Button icon={<EyeOutlined />} size="small">Открыть</Button>
        </Link>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Приёмки</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          Новая поставка
        </Button>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            placeholder="Точка"
            allowClear
            style={{ width: 200 }}
            value={selectedLocation}
            onChange={(v) => setSelectedLocation(v)}
            options={locations?.map(l => ({ value: l.id, label: l.name }))}
          />
          <Select
            placeholder="Статус"
            allowClear
            style={{ width: 150 }}
            value={selectedStatus}
            onChange={(v) => setSelectedStatus(v)}
            options={[
              { value: 'pending', label: 'Ожидает' },
              { value: 'in_progress', label: 'В процессе' },
              { value: 'completed', label: 'Завершена' },
              { value: 'has_discrepancy', label: 'Расхождения' },
            ]}
          />
        </Space>
      </Card>

      <Table
        loading={isLoading}
        dataSource={deliveries || []}
        columns={columns}
        rowKey="id"
        pagination={{ pageSize: 20 }}
      />

      <Modal
        title="Новая ожидаемая поставка"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => {
            const lines = values.lines?.filter((l: any) => l?.stock_item_id && l?.expected_quantity) || []
            createMutation.mutate({
              ...values,
              expected_date: values.expected_date?.toISOString(),
              lines,
            })
          }}
        >
          <Form.Item name="store_location_id" label="Точка" rules={[{ required: true }]}>
            <Select options={locations?.map(l => ({ value: l.id, label: l.name }))} />
          </Form.Item>
          <Form.Item name="delivery_number" label="№ накладной">
            <Input />
          </Form.Item>
          <Form.Item name="supplier_name" label="Поставщик">
            <Input />
          </Form.Item>
          <Form.Item name="expected_date" label="Ожидаемая дата">
            <DatePicker showTime />
          </Form.Item>
          <Form.Item name="notes" label="Примечания">
            <Input.TextArea rows={2} />
          </Form.Item>

          <Typography.Text strong>Позиции:</Typography.Text>
          <Form.List name="lines">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...rest }) => (
                  <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                    <Form.Item {...rest} name={[name, 'stock_item_id']} rules={[{ required: true }]}>
                      <Select
                        placeholder="Товар"
                        style={{ width: 250 }}
                        showSearch
                        optionFilterProp="label"
                        options={stockItems?.map(i => ({ value: i.id, label: i.name }))}
                      />
                    </Form.Item>
                    <Form.Item {...rest} name={[name, 'expected_quantity']} rules={[{ required: true }]}>
                      <InputNumber placeholder="Кол-во" min={0} />
                    </Form.Item>
                    <Button onClick={() => remove(name)} danger>Удалить</Button>
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                  Добавить позицию
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </div>
  )
}
