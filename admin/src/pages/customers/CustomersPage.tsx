import { Button, Input, InputNumber, Modal, Select, Space, Table, Tag, message } from 'antd'
import type { TableProps } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../../lib/api'

interface Customer {
  id: number
  phone: string
  name: string | null
  telegram_id: number | null
  first_order_date: string | null
  orders_count: number
  orders_sum: number
  points_available: number
  points_spent: number
  created_at: string
}

interface CustomerListResponse {
  items: Customer[]
  total: number
}

const fetchCustomers = async (
  search: string,
  page: number,
  pageSize: number,
  sortBy?: string,
  sortOrder?: string
) => {
  const res = await api.get<CustomerListResponse>('/admin/customers', {
    params: {
      search: search || undefined,
      offset: (page - 1) * pageSize,
      limit: pageSize,
      sort_by: sortBy || undefined,
      sort_order: sortOrder || undefined,
    },
  })
  return res.data
}

export const CustomersPage = () => {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [sortBy, setSortBy] = useState<string | undefined>(undefined)
  const [sortOrder, setSortOrder] = useState<string | undefined>(undefined)

  // Modal state
  const [modalVisible, setModalVisible] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'subtract' | 'set'>('add')
  const [adjustmentAmount, setAdjustmentAmount] = useState<number>(0)
  const [adjustmentReason, setAdjustmentReason] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['customers', search, page, pageSize, sortBy, sortOrder],
    queryFn: () => fetchCustomers(search, page, pageSize, sortBy, sortOrder),
  })

  const adjustPoints = useMutation({
    mutationFn: async ({ userId, amount, type, reason }: { userId: number; amount: number; type: string; reason: string }) =>
      api.post(`/admin/customers/${userId}/points`, { amount, type, reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      message.success('Баллы успешно изменены')
      closeModal()
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || 'Ошибка при изменении баллов')
    },
  })

  const openModal = (customer: Customer) => {
    setSelectedCustomer(customer)
    setAdjustmentType('add')
    setAdjustmentAmount(0)
    setAdjustmentReason('')
    setModalVisible(true)
  }

  const closeModal = () => {
    setModalVisible(false)
    setSelectedCustomer(null)
    setAdjustmentAmount(0)
    setAdjustmentReason('')
  }

  const handleAdjust = () => {
    if (!selectedCustomer || adjustmentAmount <= 0) {
      message.warning('Укажите корректную сумму баллов')
      return
    }
    adjustPoints.mutate({
      userId: selectedCustomer.id,
      amount: adjustmentAmount,
      type: adjustmentType,
      reason: adjustmentReason,
    })
  }

  const handleTableChange: TableProps<Customer>['onChange'] = (_pagination, _filters, sorter) => {
    if (Array.isArray(sorter)) return
    if (sorter.field && sorter.order) {
      setSortBy(sorter.field as string)
      setSortOrder(sorter.order as string)
    } else {
      setSortBy(undefined)
      setSortOrder(undefined)
    }
    setPage(1)
  }

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 70,
      sorter: true,
      sortOrder: sortBy === 'id' ? sortOrder as 'ascend' | 'descend' : undefined,
    },
    {
      title: 'Телефон',
      dataIndex: 'phone',
      width: 150,
      sorter: true,
      sortOrder: sortBy === 'phone' ? sortOrder as 'ascend' | 'descend' : undefined,
    },
    {
      title: 'Имя',
      dataIndex: 'name',
      width: 150,
      render: (v: string | null) => v || '—',
      sorter: true,
      sortOrder: sortBy === 'name' ? sortOrder as 'ascend' | 'descend' : undefined,
    },
    {
      title: 'Заказов',
      dataIndex: 'orders_count',
      width: 90,
      align: 'center' as const,
      sorter: true,
      sortOrder: sortBy === 'orders_count' ? sortOrder as 'ascend' | 'descend' : undefined,
    },
    {
      title: 'Сумма заказов',
      dataIndex: 'orders_sum',
      width: 130,
      render: (v: number) => `${v.toLocaleString('ru-RU')} ₽`,
      sorter: true,
      sortOrder: sortBy === 'orders_sum' ? sortOrder as 'ascend' | 'descend' : undefined,
    },
    {
      title: 'Баллы',
      dataIndex: 'points_available',
      width: 100,
      render: (v: number) => (
        <Tag color={v > 0 ? 'green' : 'default'}>{v.toFixed(0)}</Tag>
      ),
      sorter: true,
      sortOrder: sortBy === 'points_available' ? sortOrder as 'ascend' | 'descend' : undefined,
    },
    {
      title: 'Потрачено',
      dataIndex: 'points_spent',
      width: 100,
      render: (v: number) => v.toFixed(0),
      sorter: true,
      sortOrder: sortBy === 'points_spent' ? sortOrder as 'ascend' | 'descend' : undefined,
    },
    {
      title: 'Действия',
      width: 150,
      render: (_: any, record: Customer) => (
        <Button size="small" onClick={() => openModal(record)}>
          Изменить баллы
        </Button>
      ),
    },
  ]

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="Поиск по телефону, имени или ID"
          allowClear
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          onSearch={() => setPage(1)}
          style={{ width: 300 }}
        />
      </Space>

      <Table
        loading={isLoading}
        dataSource={data?.items || []}
        columns={columns}
        rowKey="id"
        onChange={handleTableChange}
        pagination={{
          current: page,
          pageSize: pageSize,
          total: data?.total || 0,
          showSizeChanger: true,
          pageSizeOptions: ['20', '50', '100'],
          showTotal: (total) => `Всего: ${total}`,
          onChange: (p, ps) => {
            setPage(p)
            setPageSize(ps)
          },
        }}
        scroll={{ x: 1100 }}
      />

      <Modal
        title={`Изменение баллов: ${selectedCustomer?.name || selectedCustomer?.phone || ''}`}
        open={modalVisible}
        onCancel={closeModal}
        onOk={handleAdjust}
        okText="Применить"
        cancelText="Отмена"
        confirmLoading={adjustPoints.isPending}
      >
        {selectedCustomer && (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div>
              <strong>Текущий баланс:</strong> {selectedCustomer.points_available.toFixed(0)} баллов
            </div>

            <div>
              <label>Тип операции:</label>
              <Select
                value={adjustmentType}
                onChange={setAdjustmentType}
                style={{ width: '100%', marginTop: 4 }}
                options={[
                  { value: 'add', label: 'Начислить баллы' },
                  { value: 'subtract', label: 'Списать баллы' },
                  { value: 'set', label: 'Установить баланс' },
                ]}
              />
            </div>

            <div>
              <label>Количество баллов:</label>
              <InputNumber
                value={adjustmentAmount}
                onChange={(v) => setAdjustmentAmount(v || 0)}
                min={0}
                style={{ width: '100%', marginTop: 4 }}
              />
            </div>

            <div>
              <label>Причина (опционально):</label>
              <Input
                value={adjustmentReason}
                onChange={(e) => setAdjustmentReason(e.target.value)}
                placeholder="Например: Компенсация за задержку доставки"
                style={{ marginTop: 4 }}
              />
            </div>

            {adjustmentType !== 'set' && adjustmentAmount > 0 && (
              <div>
                <strong>Новый баланс:</strong>{' '}
                {adjustmentType === 'add'
                  ? (selectedCustomer.points_available + adjustmentAmount).toFixed(0)
                  : Math.max(0, selectedCustomer.points_available - adjustmentAmount).toFixed(0)}{' '}
                баллов
              </div>
            )}
            {adjustmentType === 'set' && (
              <div>
                <strong>Новый баланс:</strong> {adjustmentAmount.toFixed(0)} баллов
              </div>
            )}
          </Space>
        )}
      </Modal>
    </>
  )
}
