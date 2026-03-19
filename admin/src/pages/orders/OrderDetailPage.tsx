import { Descriptions, Divider, List, Tag } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { api } from '../../lib/api'

const fetchOrder = async (id: string) => (await api.get(`/admin/orders/${id}`)).data
const statusLabels: Record<string, string> = {
  new: 'Новый',
  pending_payment: 'Ожидает оплаты',
  paid: 'Оплачен',
  in_progress: 'В работе',
  delivered: 'Доставлен',
  cancelled: 'Отменён',
}

export const OrderDetailPage = () => {
  const { id } = useParams()
  const { data, isLoading } = useQuery({ queryKey: ['order', id], queryFn: () => fetchOrder(id!), enabled: !!id })

  if (isLoading || !data) return null

  return (
    <div>
      <Descriptions title={`Заказ #${data.id}`} bordered column={1}>
        <Descriptions.Item label="Пользователь">{data.user_id}</Descriptions.Item>
        <Descriptions.Item label="Статус">
          <Tag>{statusLabels[data.status] || data.status}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Тип доставки">{data.delivery_type}</Descriptions.Item>
        <Descriptions.Item label="Адрес">{data.address_text}</Descriptions.Item>
        <Descriptions.Item label="Город">{data.city}</Descriptions.Item>
        <Descriptions.Item label="Сумма">{data.total} ₽</Descriptions.Item>
        <Descriptions.Item label="Стоимость доставки">{data.delivery_fee} ₽</Descriptions.Item>
        <Descriptions.Item label="Скидка">{data.discount} ₽</Descriptions.Item>
        <Descriptions.Item label="Комментарий">{data.comment}</Descriptions.Item>
        <Descriptions.Item label="Не звонить">{data.no_call ? 'Да' : 'Нет'}</Descriptions.Item>
      </Descriptions>

      <Divider />
      <List
        header="Позиции"
        dataSource={data.items || []}
        renderItem={(item: any) => (
          <List.Item>
            #{item.product_id} размер:{item.size_id ?? '-'} кол-во:{item.quantity} цена:{item.final_price} ₽
          </List.Item>
        )}
      />
    </div>
  )
}


