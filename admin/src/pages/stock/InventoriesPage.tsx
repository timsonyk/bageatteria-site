import { Button, Table, Tag, Space, Select, DatePicker, Card, Typography } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../../lib/api'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons'

const { Title } = Typography

interface Inventory {
  id: number
  store_location_id: number
  store_location_name: string
  date: string
  status: string
  conducted_by_name: string | null
  has_discrepancies: boolean
  discrepancies_within_tolerance: boolean
  lines_count: number
  created_at: string
}

interface StoreLocation {
  id: number
  name: string
}

const fetchInventories = async (params: any): Promise<Inventory[]> => {
  const res = await api.get('/admin/stock/inventories', { params })
  return res.data
}

const fetchLocations = async (): Promise<StoreLocation[]> => {
  const res = await api.get('/admin/store-locations')
  return res.data
}

const getStatusTag = (status: string, hasDiscrepancies: boolean, withinTolerance: boolean) => {
  switch (status) {
    case 'draft':
      return <Tag color="default">Черновик</Tag>
    case 'submitted':
      return <Tag color="blue" icon={<ClockCircleOutlined />}>На проверке</Tag>
    case 'ok':
      return <Tag color="green" icon={<CheckCircleOutlined />}>ОК</Tag>
    case 'discrepancy':
      return <Tag color="red" icon={<ExclamationCircleOutlined />}>Расхождения</Tag>
    case 'accepted':
      return <Tag color="green" icon={<CheckCircleOutlined />}>Принята</Tag>
    case 'rejected':
      return <Tag color="default" icon={<CloseCircleOutlined />}>Отклонена</Tag>
    default:
      return <Tag>{status}</Tag>
  }
}

export const InventoriesPage = () => {
  const [selectedLocation, setSelectedLocation] = useState<number | undefined>()
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>()

  const { data: inventories, isLoading } = useQuery({
    queryKey: ['inventories', selectedLocation, selectedStatus],
    queryFn: () => fetchInventories({
      store_location_id: selectedLocation,
      status: selectedStatus,
    }),
  })

  const { data: locations } = useQuery({
    queryKey: ['store-locations'],
    queryFn: fetchLocations,
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
      title: 'Дата',
      dataIndex: 'date',
      key: 'date',
      render: (v: string) => dayjs(v).format('DD.MM.YYYY'),
    },
    {
      title: 'Статус',
      key: 'status',
      render: (_: any, record: Inventory) => getStatusTag(
        record.status,
        record.has_discrepancies,
        record.discrepancies_within_tolerance
      ),
    },
    {
      title: 'Расхождения',
      key: 'discrepancies',
      render: (_: any, record: Inventory) => {
        if (!record.has_discrepancies) {
          return <Tag color="green">Нет</Tag>
        }
        return record.discrepancies_within_tolerance
          ? <Tag color="orange">В допуске</Tag>
          : <Tag color="red">За допуском</Tag>
      },
    },
    {
      title: 'Позиций',
      dataIndex: 'lines_count',
      key: 'lines',
    },
    {
      title: 'Провёл',
      dataIndex: 'conducted_by_name',
      key: 'conducted',
      render: (v: string | null) => v || '-',
    },
    {
      title: 'Создана',
      dataIndex: 'created_at',
      key: 'created',
      render: (v: string) => dayjs(v).format('DD.MM.YYYY HH:mm'),
    },
    {
      title: 'Действия',
      key: 'actions',
      render: (_: any, record: Inventory) => (
        <Link to={`/stock/inventories/${record.id}`}>
          <Button icon={<EyeOutlined />} size="small">Открыть</Button>
        </Link>
      ),
    },
  ]

  return (
    <div>
      <Title level={3}>Инвентаризации</Title>

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
              { value: 'draft', label: 'Черновик' },
              { value: 'submitted', label: 'На проверке' },
              { value: 'ok', label: 'ОК' },
              { value: 'discrepancy', label: 'Расхождения' },
              { value: 'accepted', label: 'Принята' },
              { value: 'rejected', label: 'Отклонена' },
            ]}
          />
        </Space>
      </Card>

      <Table
        loading={isLoading}
        dataSource={inventories || []}
        columns={columns}
        rowKey="id"
        pagination={{ pageSize: 20 }}
      />
    </div>
  )
}
