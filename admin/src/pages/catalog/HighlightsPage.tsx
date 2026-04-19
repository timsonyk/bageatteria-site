import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Select, Space, Typography, message } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'

interface Product {
  id: number
  name: string
  category_id: number
  base_price: number
  is_active: boolean
  is_recommended_menu: boolean
  is_recommended_favorites: boolean
  is_featured_menu: boolean
}

interface Category {
  id: number
  name: string
}

const fetchProducts = async (): Promise<Product[]> =>
  (await api.get('/admin/products')).data

const fetchCategories = async (): Promise<Category[]> =>
  (await api.get('/admin/categories')).data

type FlagKey = 'is_recommended_menu' | 'is_recommended_favorites' | 'is_featured_menu'

export const HighlightsPage = () => {
  const qc = useQueryClient()

  const { data: products } = useQuery({ queryKey: ['products'], queryFn: fetchProducts })
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: fetchCategories })

  const [menuRec, setMenuRec] = useState<number[]>([])
  const [favRec, setFavRec] = useState<number[]>([])
  const [featured, setFeatured] = useState<number | null>(null)

  useEffect(() => {
    if (!products) return
    setMenuRec(products.filter((p) => p.is_recommended_menu).map((p) => p.id))
    setFavRec(products.filter((p) => p.is_recommended_favorites).map((p) => p.id))
    setFeatured(products.find((p) => p.is_featured_menu)?.id ?? null)
  }, [products])

  const productOptions = useMemo(() => {
    if (!products || !categories) return []
    const catMap = new Map(categories.map((c) => [c.id, c.name]))
    return products
      .filter((p) => p.is_active)
      .map((p) => ({
        value: p.id,
        label: `${p.name} (${catMap.get(p.category_id) ?? '—'}) — ${p.base_price} ₽`,
      }))
  }, [products, categories])

  const syncFlag = async (flag: FlagKey, desired: number[]) => {
    if (!products) return
    const desiredSet = new Set(desired)
    const updates: Promise<unknown>[] = []
    for (const p of products) {
      const current = Boolean(p[flag])
      const want = desiredSet.has(p.id)
      if (current !== want) {
        updates.push(api.put(`/admin/products/${p.id}`, { [flag]: want }))
      }
    }
    await Promise.all(updates)
  }

  const saveMenuRec = useMutation({
    mutationFn: () => syncFlag('is_recommended_menu', menuRec),
    onSuccess: () => {
      message.success('Сохранено')
      qc.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e?.response?.data?.detail || 'Ошибка сохранения'),
  })

  const saveFavRec = useMutation({
    mutationFn: () => syncFlag('is_recommended_favorites', favRec),
    onSuccess: () => {
      message.success('Сохранено')
      qc.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e?.response?.data?.detail || 'Ошибка сохранения'),
  })

  const saveFeatured = useMutation({
    mutationFn: () => syncFlag('is_featured_menu', featured !== null ? [featured] : []),
    onSuccess: () => {
      message.success('Сохранено')
      qc.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e?.response?.data?.detail || 'Ошибка сохранения'),
  })

  const initialMenuRec = useMemo(
    () => (products ?? []).filter((p) => p.is_recommended_menu).map((p) => p.id),
    [products]
  )
  const initialFavRec = useMemo(
    () => (products ?? []).filter((p) => p.is_recommended_favorites).map((p) => p.id),
    [products]
  )
  const initialFeatured = useMemo(
    () => (products ?? []).find((p) => p.is_featured_menu)?.id ?? null,
    [products]
  )

  const sameSet = (a: number[], b: number[]) =>
    a.length === b.length && a.every((x) => b.includes(x))

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        Рекомендации
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
        Подборки товаров, которые публичный сайт показывает на главной и в листе избранного.
      </Typography.Paragraph>

      <Card
        title="Рекомендуем на главной"
        extra={
          <Button
            type="primary"
            size="small"
            loading={saveMenuRec.isPending}
            disabled={sameSet(menuRec, initialMenuRec)}
            onClick={() => saveMenuRec.mutate()}
          >
            Сохранить
          </Button>
        }
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
          Горизонтальный скроллер над каталогом меню.
        </Typography.Paragraph>
        <Select
          mode="multiple"
          placeholder="Выберите товары"
          style={{ width: '100%' }}
          value={menuRec}
          onChange={setMenuRec}
          options={productOptions}
          optionFilterProp="label"
          showSearch
          maxTagCount="responsive"
        />
      </Card>

      <Card
        title="Сегодня в фокусе"
        extra={
          <Button
            type="primary"
            size="small"
            loading={saveFeatured.isPending}
            disabled={featured === initialFeatured}
            onClick={() => saveFeatured.mutate()}
          >
            Сохранить
          </Button>
        }
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
          Большая карточка-баннер на главной. Только один товар.
        </Typography.Paragraph>
        <Select
          placeholder="Не выбрано"
          style={{ width: '100%' }}
          value={featured}
          onChange={(v) => setFeatured(v ?? null)}
          options={productOptions}
          optionFilterProp="label"
          showSearch
          allowClear
        />
      </Card>

      <Card
        title="Рекомендуем в избранном"
        extra={
          <Button
            type="primary"
            size="small"
            loading={saveFavRec.isPending}
            disabled={sameSet(favRec, initialFavRec)}
            onClick={() => saveFavRec.mutate()}
          >
            Сохранить
          </Button>
        }
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
          Блок «Попробуйте ещё» внизу листа избранного.
        </Typography.Paragraph>
        <Select
          mode="multiple"
          placeholder="Выберите товары"
          style={{ width: '100%' }}
          value={favRec}
          onChange={setFavRec}
          options={productOptions}
          optionFilterProp="label"
          showSearch
          maxTagCount="responsive"
        />
      </Card>
    </Space>
  )
}
