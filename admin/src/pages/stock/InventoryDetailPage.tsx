import { Card, Descriptions, Table, Tag, Typography, Spin, Row, Col, Alert, Button, Space, Modal, Input, message } from 'antd'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { useState } from 'react'
import dayjs from 'dayjs'
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  ArrowLeftOutlined,
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons'

const { Title, Text } = Typography

interface InventoryLine {
  id: number
  stock_item_id: number
  expected_quantity: number
  actual_quantity: number | null
  discrepancy: number | null
  tolerance: number
  within_tolerance: boolean | null
  notes: string | null
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

interface Inventory {
  id: number
  store_location_id: number
  date: string
  status: string
  conducted_by_telegram_id: number | null
  conducted_by_name: string | null
  reviewed_by_admin_id: number | null
  reviewed_at: string | null
  notes: string | null
  review_notes: string | null
  has_discrepancies: boolean
  discrepancies_within_tolerance: boolean
  created_at: string
  updated_at: string
  lines: InventoryLine[]
}

const fetchInventory = async (id: string): Promise<Inventory> => {
  const res = await api.get(`/admin/stock/inventories/${id}`)
  return res.data
}

const getStatusTag = (status: string) => {
  switch (status) {
    case 'draft':
      return <Tag color="default">Черновик</Tag>
    case 'submitted':
      return <Tag color="blue" icon={<ClockCircleOutlined />}>На проверке</Tag>
    case 'ok':
      return <Tag color="green" icon={<CheckCircleOutlined />}>ОК (авто)</Tag>
    case 'discrepancy':
      return <Tag color="red" icon={<ExclamationCircleOutlined />}>Требует проверки</Tag>
    case 'accepted':
      return <Tag color="green" icon={<CheckCircleOutlined />}>Принята</Tag>
    case 'rejected':
      return <Tag color="default">Отклонена</Tag>
    default:
      return <Tag>{status}</Tag>
  }
}

export const InventoryDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectNotes, setRejectNotes] = useState('')

  const { data: inventory, isLoading } = useQuery({
    queryKey: ['inventory', id],
    queryFn: () => fetchInventory(id!),
    enabled: !!id,
  })

  const acceptMutation = useMutation({
    mutationFn: async () => {
      return api.post(`/admin/stock/inventories/${id}/accept`)
    },
    onSuccess: () => {
      message.success('Инвентаризация принята, остатки обновлены')
      qc.invalidateQueries({ queryKey: ['inventory', id] })
      qc.invalidateQueries({ queryKey: ['inventories'] })
    },
    onError: () => {
      message.error('Ошибка при принятии инвентаризации')
    },
  })

  const rejectMutation = useMutation({
    mutationFn: async () => {
      return api.post(`/admin/stock/inventories/${id}/reject`, null, {
        params: { review_notes: rejectNotes },
      })
    },
    onSuccess: () => {
      message.success('Инвентаризация отклонена')
      setRejectModalOpen(false)
      qc.invalidateQueries({ queryKey: ['inventory', id] })
      qc.invalidateQueries({ queryKey: ['inventories'] })
    },
    onError: () => {
      message.error('Ошибка при отклонении инвентаризации')
    },
  })

  if (isLoading) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />
  }

  if (!inventory) {
    return <Alert message="Инвентаризация не найдена" type="error" />
  }

  const canReview = ['submitted', 'ok', 'discrepancy'].includes(inventory.status)

  const columns = [
    {
      title: 'Товар',
      key: 'item',
      render: (_: any, record: InventoryLine) => (
        <div>
          <div>{record.stock_item?.name || `ID: ${record.stock_item_id}`}</div>
          <small style={{ color: '#888' }}>
            {record.stock_item?.stock_category?.name}
          </small>
        </div>
      ),
    },
    {
      title: 'Расчётный остаток',
      dataIndex: 'expected_quantity',
      key: 'expected',
      render: (v: number, record: InventoryLine) => {
        const unit = record.stock_item?.unit || record.stock_item?.stock_category?.unit || 'шт'
        return `${v} ${unit}`
      },
    },
    {
      title: 'Фактический',
      dataIndex: 'actual_quantity',
      key: 'actual',
      render: (v: number | null, record: InventoryLine) => {
        if (v === null) return <Tag>Не указано</Tag>
        const unit = record.stock_item?.unit || record.stock_item?.stock_category?.unit || 'шт'
        return `${v} ${unit}`
      },
    },
    {
      title: 'Расхождение',
      dataIndex: 'discrepancy',
      key: 'discrepancy',
      render: (v: number | null, record: InventoryLine) => {
        if (v === null || v === 0) return <Tag color="green">0</Tag>
        const color = record.within_tolerance ? 'orange' : 'red'
        return <Tag color={color}>{v > 0 ? '+' : ''}{v}</Tag>
      },
    },
    {
      title: 'Допуск',
      dataIndex: 'tolerance',
      key: 'tolerance',
      render: (v: number) => `±${v}`,
    },
    {
      title: 'Статус',
      key: 'status',
      render: (_: any, record: InventoryLine) => {
        if (record.discrepancy === null || record.discrepancy === 0) {
          return <Tag color="green" icon={<CheckCircleOutlined />}>ОК</Tag>
        }
        return record.within_tolerance
          ? <Tag color="orange">В допуске</Tag>
          : <Tag color="red" icon={<ExclamationCircleOutlined />}>За допуском</Tag>
      },
    },
    {
      title: 'Комментарий',
      dataIndex: 'notes',
      key: 'notes',
      render: (v: string | null) => v || '-',
    },
  ]

  // Summary stats
  const totalItems = inventory.lines.length
  const itemsWithDiscrepancy = inventory.lines.filter(l => l.discrepancy && l.discrepancy !== 0).length
  const itemsOutOfTolerance = inventory.lines.filter(l => l.within_tolerance === false).length

  return (
    <div>
      <Link to="/stock/inventories" style={{ display: 'inline-flex', alignItems: 'center', marginBottom: 16 }}>
        <ArrowLeftOutlined style={{ marginRight: 8 }} /> Назад к списку
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>
          Инвентаризация #{inventory.id}
        </Title>
        <Space>
          {getStatusTag(inventory.status)}
          {canReview && (
            <>
              <Button
                type="primary"
                icon={<CheckOutlined />}
                onClick={() => acceptMutation.mutate()}
                loading={acceptMutation.isPending}
              >
                Принять
              </Button>
              <Button
                danger
                icon={<CloseOutlined />}
                onClick={() => setRejectModalOpen(true)}
              >
                Отклонить
              </Button>
            </>
          )}
        </Space>
      </div>

      {inventory.has_discrepancies && !inventory.discrepancies_within_tolerance && (
        <Alert
          message="Обнаружены расхождения за пределами допуска"
          description={`${itemsOutOfTolerance} из ${totalItems} позиций требуют внимания`}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {inventory.has_discrepancies && inventory.discrepancies_within_tolerance && (
        <Alert
          message="Есть расхождения, но все в пределах допуска"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={16}>
          <Card title="Информация">
            <Descriptions column={2}>
              <Descriptions.Item label="Дата">
                {dayjs(inventory.date).format('DD.MM.YYYY HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="Провёл">
                {inventory.conducted_by_name || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Создана">
                {dayjs(inventory.created_at).format('DD.MM.YYYY HH:mm')}
              </Descriptions.Item>
              {inventory.reviewed_at && (
                <Descriptions.Item label="Проверена">
                  {dayjs(inventory.reviewed_at).format('DD.MM.YYYY HH:mm')}
                </Descriptions.Item>
              )}
              {inventory.notes && (
                <Descriptions.Item label="Примечания бариста" span={2}>
                  {inventory.notes}
                </Descriptions.Item>
              )}
              {inventory.review_notes && (
                <Descriptions.Item label="Примечания руководителя" span={2}>
                  {inventory.review_notes}
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, fontWeight: 'bold', color: itemsOutOfTolerance > 0 ? '#ff4d4f' : '#52c41a' }}>
                {totalItems - itemsWithDiscrepancy}/{totalItems}
              </div>
              <Text type="secondary">Позиций без расхождений</Text>
            </div>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-around' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 'bold', color: '#faad14' }}>
                  {itemsWithDiscrepancy - itemsOutOfTolerance}
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>В допуске</Text>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 'bold', color: '#ff4d4f' }}>
                  {itemsOutOfTolerance}
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>За допуском</Text>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Card title={`Позиции (${inventory.lines.length})`}>
        <Table
          dataSource={inventory.lines}
          columns={columns}
          rowKey="id"
          pagination={false}
          rowClassName={(record) => {
            if (record.within_tolerance === false) return 'ant-table-row-error'
            return ''
          }}
        />
      </Card>

      <Modal
        title="Отклонить инвентаризацию"
        open={rejectModalOpen}
        onCancel={() => setRejectModalOpen(false)}
        onOk={() => rejectMutation.mutate()}
        confirmLoading={rejectMutation.isPending}
      >
        <Input.TextArea
          placeholder="Причина отклонения (необязательно)"
          rows={3}
          value={rejectNotes}
          onChange={(e) => setRejectNotes(e.target.value)}
        />
      </Modal>
    </div>
  )
}
