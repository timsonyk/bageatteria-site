import { Card, Descriptions, Table, Tag, Image, Typography, Spin, Row, Col, Alert } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'
import { api } from '../../lib/api'
import dayjs from 'dayjs'
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons'

const { Title } = Typography

interface DeliveryLine {
  id: number
  stock_item_id: number
  expected_quantity: number
  actual_quantity: number | null
  discrepancy_reason: string | null
  discrepancy_notes: string | null
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

interface DeliveryPhoto {
  id: number
  photo_url: string
  thumbnail_url: string | null
  uploaded_at: string
}

interface Delivery {
  id: number
  store_location_id: number
  delivery_number: string | null
  supplier_name: string | null
  expected_date: string | null
  actual_date: string | null
  status: string
  received_by_telegram_id: number | null
  received_by_name: string | null
  notes: string | null
  iiko_document_id: string | null
  created_at: string
  updated_at: string
  lines: DeliveryLine[]
  photos: DeliveryPhoto[]
}

const fetchDelivery = async (id: string): Promise<Delivery> => {
  const res = await api.get(`/admin/stock/deliveries/${id}`)
  return res.data
}

const getStatusTag = (status: string) => {
  switch (status) {
    case 'pending':
      return <Tag color="orange" icon={<ClockCircleOutlined />}>Ожидает приёмки</Tag>
    case 'in_progress':
      return <Tag color="blue">В процессе</Tag>
    case 'completed':
      return <Tag color="green" icon={<CheckCircleOutlined />}>Завершена</Tag>
    case 'has_discrepancy':
      return <Tag color="red" icon={<ExclamationCircleOutlined />}>С расхождениями</Tag>
    default:
      return <Tag>{status}</Tag>
  }
}

const getDiscrepancyReasonLabel = (reason: string | null) => {
  if (!reason) return '-'
  switch (reason) {
    case 'shortage': return 'Недовоз'
    case 'damage': return 'Брак'
    case 'mismatch': return 'Пересорт'
    case 'excess': return 'Излишек'
    default: return reason
  }
}

export const DeliveryDetailPage = () => {
  const { id } = useParams<{ id: string }>()

  const { data: delivery, isLoading } = useQuery({
    queryKey: ['delivery', id],
    queryFn: () => fetchDelivery(id!),
    enabled: !!id,
  })

  if (isLoading) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />
  }

  if (!delivery) {
    return <Alert message="Поставка не найдена" type="error" />
  }

  const hasDiscrepancies = delivery.lines.some(
    line => line.actual_quantity !== null && line.actual_quantity !== line.expected_quantity
  )

  const columns = [
    {
      title: 'Товар',
      key: 'item',
      render: (_: any, record: DeliveryLine) => (
        <div>
          <div>{record.stock_item?.name || `ID: ${record.stock_item_id}`}</div>
          <small style={{ color: '#888' }}>
            {record.stock_item?.stock_category?.name}
          </small>
        </div>
      ),
    },
    {
      title: 'Ожидалось',
      dataIndex: 'expected_quantity',
      key: 'expected',
      render: (v: number, record: DeliveryLine) => {
        const unit = record.stock_item?.unit || record.stock_item?.stock_category?.unit || 'шт'
        return `${v} ${unit}`
      },
    },
    {
      title: 'Фактически',
      dataIndex: 'actual_quantity',
      key: 'actual',
      render: (v: number | null, record: DeliveryLine) => {
        if (v === null) return <Tag>Не принято</Tag>
        const unit = record.stock_item?.unit || record.stock_item?.stock_category?.unit || 'шт'
        const diff = v - record.expected_quantity
        const color = diff === 0 ? 'green' : diff > 0 ? 'blue' : 'red'
        return (
          <span>
            {v} {unit}{' '}
            {diff !== 0 && (
              <Tag color={color}>{diff > 0 ? '+' : ''}{diff}</Tag>
            )}
          </span>
        )
      },
    },
    {
      title: 'Причина расхождения',
      dataIndex: 'discrepancy_reason',
      key: 'reason',
      render: (v: string | null) => getDiscrepancyReasonLabel(v),
    },
    {
      title: 'Комментарий',
      dataIndex: 'discrepancy_notes',
      key: 'notes',
      render: (v: string | null) => v || '-',
    },
  ]

  return (
    <div>
      <Link to="/stock/deliveries" style={{ display: 'inline-flex', alignItems: 'center', marginBottom: 16 }}>
        <ArrowLeftOutlined style={{ marginRight: 8 }} /> Назад к списку
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>
          Приёмка #{delivery.id}
        </Title>
        {getStatusTag(delivery.status)}
      </div>

      {hasDiscrepancies && (
        <Alert
          message="Есть расхождения с накладной"
          description="Некоторые позиции отличаются от ожидаемого количества"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Row gutter={16}>
        <Col span={16}>
          <Card title="Информация о поставке" style={{ marginBottom: 16 }}>
            <Descriptions column={2}>
              <Descriptions.Item label="№ накладной">
                {delivery.delivery_number || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Поставщик">
                {delivery.supplier_name || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Ожидаемая дата">
                {delivery.expected_date ? dayjs(delivery.expected_date).format('DD.MM.YYYY HH:mm') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Фактическая дата">
                {delivery.actual_date ? dayjs(delivery.actual_date).format('DD.MM.YYYY HH:mm') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Принял">
                {delivery.received_by_name || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Создана">
                {dayjs(delivery.created_at).format('DD.MM.YYYY HH:mm')}
              </Descriptions.Item>
              {delivery.notes && (
                <Descriptions.Item label="Примечания" span={2}>
                  {delivery.notes}
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>

          <Card title={`Позиции (${delivery.lines.length})`}>
            <Table
              dataSource={delivery.lines}
              columns={columns}
              rowKey="id"
              pagination={false}
            />
          </Card>
        </Col>

        <Col span={8}>
          <Card title={`Фото приёмки (${delivery.photos.length})`}>
            {delivery.photos.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#999', padding: 20 }}>
                Нет фотографий
              </div>
            ) : (
              <Image.PreviewGroup>
                <Row gutter={[8, 8]}>
                  {delivery.photos.map(photo => (
                    <Col span={12} key={photo.id}>
                      <Image
                        src={photo.photo_url}
                        alt="Фото приёмки"
                        style={{ width: '100%', borderRadius: 8 }}
                      />
                      <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                        {dayjs(photo.uploaded_at).format('DD.MM HH:mm')}
                      </div>
                    </Col>
                  ))}
                </Row>
              </Image.PreviewGroup>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}
