import { useEffect, useState } from 'react'
import { Button, Card, Select, Space, Table, Typography, message } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'

interface Category {
  id: number
  name: string
  is_active: boolean
  sort_order: number
}

interface Product {
  id: number
  name: string
  category_id: number
  base_price: number
  is_active: boolean
}

interface Recommendation {
  id: number
  category_id: number
  product_id: number
  sort_order: number
}

const fetchCategories = async (): Promise<Category[]> =>
  (await api.get('/admin/categories')).data

const fetchProducts = async (): Promise<Product[]> =>
  (await api.get('/admin/products')).data

const fetchAllRecommendations = async (): Promise<Recommendation[]> =>
  (await api.get('/admin/recommendations')).data

export const RecommendationsPage = () => {
  const qc = useQueryClient()

  // State: categoryId -> selected product ids
  const [selections, setSelections] = useState<Record<number, number[]>>({})
  const [savingCategory, setSavingCategory] = useState<number | null>(null)

  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  })

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  })

  const { data: recommendations } = useQuery({
    queryKey: ['recommendations'],
    queryFn: fetchAllRecommendations,
  })

  // Initialize selections from recommendations
  useEffect(() => {
    if (recommendations && categories) {
      const newSelections: Record<number, number[]> = {}
      for (const cat of categories) {
        const recs = recommendations.filter((r) => r.category_id === cat.id)
        newSelections[cat.id] = recs.map((r) => r.product_id)
      }
      setSelections(newSelections)
    }
  }, [recommendations, categories])

  const saveMutation = useMutation({
    mutationFn: async ({ categoryId, productIds }: { categoryId: number; productIds: number[] }) => {
      await api.post('/admin/recommendations/bulk', {
        category_id: categoryId,
        product_ids: productIds,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recommendations'] })
      message.success('Сохранено')
      setSavingCategory(null)
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.detail || 'Ошибка сохранения')
      setSavingCategory(null)
    },
  })

  const handleSelectionChange = (categoryId: number, productIds: number[]) => {
    setSelections((prev) => ({ ...prev, [categoryId]: productIds }))
  }

  const handleSave = (categoryId: number) => {
    setSavingCategory(categoryId)
    saveMutation.mutate({ categoryId, productIds: selections[categoryId] || [] })
  }

  // Get product options for a category (exclude products from same category)
  const getProductOptions = (categoryId: number) => {
    return (products || [])
      .filter((p) => p.is_active && p.category_id !== categoryId)
      .map((p) => {
        const catName = categories?.find((c) => c.id === p.category_id)?.name || ''
        return {
          value: p.id,
          label: `${p.name} (${catName}) — ${p.base_price} ₽`,
        }
      })
  }

  // Check if selection changed from original
  const hasChanges = (categoryId: number) => {
    const current = selections[categoryId] || []
    const original = (recommendations || [])
      .filter((r) => r.category_id === categoryId)
      .map((r) => r.product_id)

    if (current.length !== original.length) return true
    return !current.every((id) => original.includes(id))
  }

  const sortedCategories = [...(categories || [])].sort((a, b) => a.sort_order - b.sort_order)

  const columns = [
    {
      title: 'Категория',
      dataIndex: 'name',
      width: 200,
      render: (name: string) => <Typography.Text strong>{name}</Typography.Text>,
    },
    {
      title: 'Рекомендуемые товары',
      dataIndex: 'id',
      render: (categoryId: number) => (
        <Select
          mode="multiple"
          placeholder="Выберите товары"
          style={{ width: '100%' }}
          value={selections[categoryId] || []}
          onChange={(values) => handleSelectionChange(categoryId, values)}
          options={getProductOptions(categoryId)}
          optionFilterProp="label"
          showSearch
          maxTagCount={3}
        />
      ),
    },
    {
      title: '',
      width: 120,
      dataIndex: 'id',
      render: (categoryId: number) => (
        <Button
          type="primary"
          size="small"
          onClick={() => handleSave(categoryId)}
          loading={savingCategory === categoryId}
          disabled={!hasChanges(categoryId)}
        >
          Сохранить
        </Button>
      ),
    },
  ]

  return (
    <>
      <Typography.Title level={4}>Рекомендации по категориям</Typography.Title>
      <Typography.Paragraph type="secondary">
        Для каждой категории выберите товары, которые будут показываться в рекомендациях.
      </Typography.Paragraph>

      <Card>
        <Table
          loading={categoriesLoading}
          dataSource={sortedCategories}
          columns={columns}
          rowKey="id"
          pagination={false}
          size="middle"
        />
      </Card>
    </>
  )
}
