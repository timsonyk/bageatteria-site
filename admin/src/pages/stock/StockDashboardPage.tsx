import { Card, Row, Col, Statistic, Table, Tag, Typography, Spin } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  InboxOutlined,
} from '@ant-design/icons'
import { Link } from 'react-router-dom'

const { Title } = Typography

interface LocationStatus {
  store_location_id: number
  store_location_name: string
  pending_deliveries: number
  deliveries_with_discrepancies: number
  today_inventory_status: string | null
  low_stock_items: number
}

interface Dashboard {
  locations: LocationStatus[]
  total_pending_deliveries: number
  total_inventories_pending_review: number
}

const fetchDashboard = async (): Promise<Dashboard> => {
  const res = await api.get('/admin/stock/dashboard')
  return res.data
}

const getInventoryStatusTag = (status: string | null) => {
  if (!status) return <Tag>Не проведена</Tag>
  switch (status) {
    case 'ok':
    case 'accepted':
      return <Tag color="green" icon={<CheckCircleOutlined />}>ОК</Tag>
    case 'discrepancy':
      return <Tag color="red" icon={<ExclamationCircleOutlined />}>Расхождения</Tag>
    case 'submitted':
      return <Tag color="blue" icon={<ClockCircleOutlined />}>На проверке</Tag>
    case 'draft':
      return <Tag color="default">Черновик</Tag>
    default:
      return <Tag>{status}</Tag>
  }
}

export const StockDashboardPage = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['stock-dashboard'],
    queryFn: fetchDashboard,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  })

  if (isLoading) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />
  }

  const columns = [
    {
      title: 'Точка',
      dataIndex: 'store_location_name',
      key: 'name',
      render: (name: string) => <strong>{name}</strong>,
    },
    {
      title: 'Ожидают приёмки',
      dataIndex: 'pending_deliveries',
      key: 'pending',
      render: (count: number, record: LocationStatus) => (
        <Link to={`/stock/deliveries?location=${record.store_location_id}&status=pending`}>
          {count > 0 ? (
            <Tag color="orange">{count}</Tag>
          ) : (
            <Tag color="green">0</Tag>
          )}
        </Link>
      ),
    },
    {
      title: 'С расхождениями',
      dataIndex: 'deliveries_with_discrepancies',
      key: 'discrepancies',
      render: (count: number, record: LocationStatus) => (
        <Link to={`/stock/deliveries?location=${record.store_location_id}&status=has_discrepancy`}>
          {count > 0 ? (
            <Tag color="red">{count}</Tag>
          ) : (
            <Tag color="green">0</Tag>
          )}
        </Link>
      ),
    },
    {
      title: 'Инвентаризация сегодня',
      dataIndex: 'today_inventory_status',
      key: 'inventory',
      render: (status: string | null) => getInventoryStatusTag(status),
    },
  ]

  return (
    <div>
      <Title level={3}>Остатки</Title>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="Ожидают приёмки"
              value={data?.total_pending_deliveries || 0}
              prefix={<InboxOutlined />}
              valueStyle={{ color: data?.total_pending_deliveries ? '#faad14' : '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Инвентаризации на проверке"
              value={data?.total_inventories_pending_review || 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: data?.total_inventories_pending_review ? '#1890ff' : '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Точек"
              value={data?.locations?.length || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Статус по точкам">
        <Table
          dataSource={data?.locations || []}
          columns={columns}
          rowKey="store_location_id"
          pagination={false}
        />
      </Card>
    </div>
  )
}
