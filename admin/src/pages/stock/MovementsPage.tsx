import { Table, Tag, Space, Select, DatePicker, Card, Typography } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../../lib/api'
import dayjs from 'dayjs'
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  SwapOutlined,
} from '@ant-design/icons'

const { Title } = Typography
const { RangePicker } = DatePicker

interface StockMovement {
  id: number
  stock_item_id: number
  store_location_id: number
  movement_type: string
  quantity: number
  quantity_before: number
  quantity_after: number
  reference_type: string | null
  reference_id: number | null
  notes: string | null
  performed_by: string | null
  iiko_transaction_id: string | null
  created_at: string
  stock_item: {
    id: number
    name: string
    unit: string | null
    stock_category: {
      name: string
      unit: string
    } | null
  } | null
}

interface StoreLocation {
  id: number
  name: string
}

const fetchMovements = async (params: any): Promise<StockMovement[]> => {
  const res = await api.get('/admin/stock/movements', { params })
  return res.data
}

const fetchLocations = async (): Promise<StoreLocation[]> => {
  const res = await api.get('/admin/store-locations')
  return res.data
}

const getMovementTypeTag = (type: string) => {
  switch (type) {
    case 'delivery':
      return <Tag color="green" icon={<ArrowUpOutlined />}>Приход</Tag>
    case 'sale':
      return <Tag color="blue" icon={<ArrowDownOutlined />}>Продажа</Tag>
    case 'write_off':
      return <Tag color="red" icon={<ArrowDownOutlined />}>Списание</Tag>
    case 'inventory_adjustment':
      return <Tag color="orange" icon={<SwapOutlined />}>Корректировка</Tag>
    default:
      return <Tag>{type}</Tag>
  }
}


export const MovementsPage = () => {
  const [selectedLocation, setSelectedLocation] = useState<number | undefined>()
  const [selectedType, setSelectedType] = useState<string | undefined>()
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)

  const { data: movements, isLoading } = useQuery({
    queryKey: ['stock-movements', selectedLocation, selectedType, dateRange],
    queryFn: () => fetchMovements({
      store_location_id: selectedLocation,
      movement_type: selectedType,
      date_from: dateRange?.[0]?.format('YYYY-MM-DD'),
      date_to: dateRange?.[1]?.format('YYYY-MM-DD'),
    }),
  })

  const { data: locations } = useQuery({
    queryKey: ['store-locations'],
    queryFn: fetchLocations,
  })

  const columns = [
    {
      title: 'Дата',
      dataIndex: 'created_at',
      key: 'date',
      width: 140,
      render: (v: string) => dayjs(v).format('DD.MM.YYYY HH:mm'),
    },
    {
      title: 'Тип',
      dataIndex: 'movement_type',
      key: 'type',
      width: 130,
      render: (v: string) => getMovementTypeTag(v),
    },
    {
      title: 'Товар',
      key: 'item',
      render: (_: any, record: StockMovement) => (
        <div>
          <div>{record.stock_item?.name || `ID: ${record.stock_item_id}`}</div>
          <small style={{ color: '#888' }}>
            {record.stock_item?.stock_category?.name}
          </small>
        </div>
      ),
    },
    {
      title: 'Изменение',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (v: number, record: StockMovement) => {
        const unit = record.stock_item?.unit || record.stock_item?.stock_category?.unit || 'шт'
        const color = v > 0 ? 'green' : 'red'
        return <span style={{ color }}>{v > 0 ? '+' : ''}{v} {unit}</span>
      },
    },
    {
      title: 'Было',
      dataIndex: 'quantity_before',
      key: 'before',
      render: (v: number, record: StockMovement) => {
        const unit = record.stock_item?.unit || record.stock_item?.stock_category?.unit || 'шт'
        return `${v} ${unit}`
      },
    },
    {
      title: 'Стало',
      dataIndex: 'quantity_after',
      key: 'after',
      render: (v: number, record: StockMovement) => {
        const unit = record.stock_item?.unit || record.stock_item?.stock_category?.unit || 'шт'
        return `${v} ${unit}`
      },
    },
    {
      title: 'Основание',
      key: 'reference',
      render: (_: any, record: StockMovement) => {
        if (!record.reference_type) return '-'
        let label = ''
        switch (record.reference_type) {
          case 'delivery': label = 'Приёмка'; break
          case 'order': label = 'Заказ'; break
          case 'inventory': label = 'Инвентаризация'; break
          default: label = record.reference_type
        }
        return `${label} #${record.reference_id}`
      },
    },
    {
      title: 'Кто',
      dataIndex: 'performed_by',
      key: 'performer',
      render: (v: string | null) => v || '-',
    },
    {
      title: 'Примечание',
      dataIndex: 'notes',
      key: 'notes',
      render: (v: string | null) => v || '-',
    },
  ]

  return (
    <div>
      <Title level={3}>История движений</Title>

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
            placeholder="Тип операции"
            allowClear
            style={{ width: 150 }}
            value={selectedType}
            onChange={(v) => setSelectedType(v)}
            options={[
              { value: 'delivery', label: 'Приход' },
              { value: 'sale', label: 'Продажа' },
              { value: 'write_off', label: 'Списание' },
              { value: 'inventory_adjustment', label: 'Корректировка' },
            ]}
          />
          <RangePicker
            value={dateRange}
            onChange={(v) => setDateRange(v as [dayjs.Dayjs, dayjs.Dayjs] | null)}
            format="DD.MM.YYYY"
          />
        </Space>
      </Card>

      <Table
        loading={isLoading}
        dataSource={movements || []}
        columns={columns}
        rowKey="id"
        pagination={{ pageSize: 50 }}
        scroll={{ x: 1200 }}
      />
    </div>
  )
}
