import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Image as AntImage, Input, Select, Space, Typography, Upload, message, theme } from 'antd'
import type { UploadFile } from 'antd/es/upload/interface'
import { HolderOutlined, DeleteOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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
  featured_text?: string | null
  recommended_menu_order?: number | null
  recommended_favorites_order?: number | null
  featured_menu_order?: number | null
  featured_mobile_image?: string | null
  featured_desktop_image?: string | null
  sort_order: number
}

interface Category {
  id: number
  name: string
}

const API_HOST = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:8000'

function toDisplayUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  if (url.startsWith('http')) return url
  return `${API_HOST}${url}`
}

function toStoredUrl(url: string | null | undefined): string | null {
  if (!url) return null
  if (url.startsWith(API_HOST)) return url.slice(API_HOST.length)
  const m = url.match(/\/uploads\/[^?#]+/)
  return m ? m[0] : url
}

const fetchProducts = async (): Promise<Product[]> =>
  (await api.get('/admin/products')).data

const fetchCategories = async (): Promise<Category[]> =>
  (await api.get('/admin/categories')).data

type FlagKey = 'is_recommended_menu' | 'is_recommended_favorites' | 'is_featured_menu'
type OrderFlag = 'recommended_menu' | 'recommended_favorites' | 'featured_menu'

const orderFieldByFlag: Record<OrderFlag, keyof Product> = {
  recommended_menu: 'recommended_menu_order',
  recommended_favorites: 'recommended_favorites_order',
  featured_menu: 'featured_menu_order',
}

function sortByFlagOrder(list: Product[], flag: OrderFlag): Product[] {
  const field = orderFieldByFlag[flag]
  return [...list].sort((a, b) => {
    const av = a[field] as number | null | undefined
    const bv = b[field] as number | null | undefined
    if (av != null && bv != null) return av - bv
    if (av != null) return -1
    if (bv != null) return 1
    return a.sort_order - b.sort_order
  })
}

function SortableRow({
  id,
  children,
}: {
  id: number
  children: (handleProps: { listeners: ReturnType<typeof useSortable>['listeners']; attributes: ReturnType<typeof useSortable>['attributes'] }) => React.ReactNode
}) {
  const { token } = theme.useToken()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    background: token.colorBgContainer,
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: 8,
    padding: 10,
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
  }
  return (
    <div ref={setNodeRef} style={style}>
      {children({ listeners, attributes })}
    </div>
  )
}

export const HighlightsPage = () => {
  const qc = useQueryClient()

  const { data: products } = useQuery({ queryKey: ['products'], queryFn: fetchProducts })
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: fetchCategories })

  const [menuRec, setMenuRec] = useState<number[]>([])
  const [favRec, setFavRec] = useState<number[]>([])
  const [featuredIds, setFeaturedIds] = useState<number[]>([])
  const [featuredTexts, setFeaturedTexts] = useState<Record<number, string>>({})
  const [featuredMobileImages, setFeaturedMobileImages] = useState<Record<number, string | null>>({})
  const [featuredDesktopImages, setFeaturedDesktopImages] = useState<Record<number, string | null>>({})

  useEffect(() => {
    if (!products) return
    setMenuRec(sortByFlagOrder(products.filter((p) => p.is_recommended_menu), 'recommended_menu').map((p) => p.id))
    setFavRec(sortByFlagOrder(products.filter((p) => p.is_recommended_favorites), 'recommended_favorites').map((p) => p.id))
    const featured = sortByFlagOrder(products.filter((p) => p.is_featured_menu), 'featured_menu')
    setFeaturedIds(featured.map((p) => p.id))
    const texts: Record<number, string> = {}
    const mobImgs: Record<number, string | null> = {}
    const deskImgs: Record<number, string | null> = {}
    for (const p of featured) {
      texts[p.id] = p.featured_text ?? ''
      mobImgs[p.id] = p.featured_mobile_image ?? null
      deskImgs[p.id] = p.featured_desktop_image ?? null
    }
    setFeaturedTexts(texts)
    setFeaturedMobileImages(mobImgs)
    setFeaturedDesktopImages(deskImgs)
  }, [products])

  // Подтягиваем поля для свежедобавленных товаров
  useEffect(() => {
    if (!products) return
    setFeaturedTexts((prev) => {
      const next = { ...prev }
      for (const id of featuredIds) {
        if (next[id] === undefined) {
          const p = products.find((x) => x.id === id)
          next[id] = p?.featured_text ?? ''
        }
      }
      return next
    })
    setFeaturedMobileImages((prev) => {
      const next = { ...prev }
      for (const id of featuredIds) {
        if (next[id] === undefined) {
          const p = products.find((x) => x.id === id)
          next[id] = p?.featured_mobile_image ?? null
        }
      }
      return next
    })
    setFeaturedDesktopImages((prev) => {
      const next = { ...prev }
      for (const id of featuredIds) {
        if (next[id] === undefined) {
          const p = products.find((x) => x.id === id)
          next[id] = p?.featured_desktop_image ?? null
        }
      }
      return next
    })
  }, [featuredIds, products])

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

  const productById = useMemo(() => {
    const m = new Map<number, Product>()
    for (const p of products ?? []) m.set(p.id, p)
    return m
  }, [products])

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

  const saveOrder = (flag: OrderFlag, ids: number[]) =>
    api.post('/admin/highlights/order', { flag, product_ids: ids })

  const saveMenuRec = useMutation({
    mutationFn: async () => {
      await syncFlag('is_recommended_menu', menuRec)
      await saveOrder('recommended_menu', menuRec)
    },
    onSuccess: () => {
      message.success('Сохранено')
      qc.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e?.response?.data?.detail || 'Ошибка сохранения'),
  })

  const saveFavRec = useMutation({
    mutationFn: async () => {
      await syncFlag('is_recommended_favorites', favRec)
      await saveOrder('recommended_favorites', favRec)
    },
    onSuccess: () => {
      message.success('Сохранено')
      qc.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e?.response?.data?.detail || 'Ошибка сохранения'),
  })

  const saveFeatured = useMutation({
    mutationFn: async () => {
      await syncFlag('is_featured_menu', featuredIds)
      const updates: Promise<unknown>[] = []
      for (const id of featuredIds) {
        const text = (featuredTexts[id] ?? '').trim()
        const mobileImg = featuredMobileImages[id]
        const desktopImg = featuredDesktopImages[id]
        updates.push(
          api.put(`/admin/products/${id}`, {
            featured_text: text || null,
            featured_mobile_image: mobileImg ? toStoredUrl(mobileImg) : null,
            featured_desktop_image: desktopImg ? toStoredUrl(desktopImg) : null,
          })
        )
      }
      await Promise.all(updates)
      await saveOrder('featured_menu', featuredIds)
    },
    onSuccess: () => {
      message.success('Сохранено')
      qc.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e?.response?.data?.detail || 'Ошибка сохранения'),
  })

  const initialMenuRec = useMemo(
    () => sortByFlagOrder((products ?? []).filter((p) => p.is_recommended_menu), 'recommended_menu').map((p) => p.id),
    [products]
  )
  const initialFavRec = useMemo(
    () => sortByFlagOrder((products ?? []).filter((p) => p.is_recommended_favorites), 'recommended_favorites').map((p) => p.id),
    [products]
  )
  const initialFeaturedIds = useMemo(
    () => sortByFlagOrder((products ?? []).filter((p) => p.is_featured_menu), 'featured_menu').map((p) => p.id),
    [products]
  )
  const initialFeaturedTexts = useMemo(() => {
    const m: Record<number, string> = {}
    for (const p of products ?? []) {
      if (p.is_featured_menu) m[p.id] = p.featured_text ?? ''
    }
    return m
  }, [products])
  const initialFeaturedMobileImages = useMemo(() => {
    const m: Record<number, string | null> = {}
    for (const p of products ?? []) {
      if (p.is_featured_menu) m[p.id] = p.featured_mobile_image ?? null
    }
    return m
  }, [products])
  const initialFeaturedDesktopImages = useMemo(() => {
    const m: Record<number, string | null> = {}
    for (const p of products ?? []) {
      if (p.is_featured_menu) m[p.id] = p.featured_desktop_image ?? null
    }
    return m
  }, [products])

  const sameOrderedList = (a: number[], b: number[]) =>
    a.length === b.length && a.every((x, i) => x === b[i])

  const featuredChanged = useMemo(() => {
    if (!sameOrderedList(featuredIds, initialFeaturedIds)) return true
    for (const id of featuredIds) {
      if ((featuredTexts[id] ?? '') !== (initialFeaturedTexts[id] ?? '')) return true
      if ((featuredMobileImages[id] ?? null) !== (initialFeaturedMobileImages[id] ?? null)) return true
      if ((featuredDesktopImages[id] ?? null) !== (initialFeaturedDesktopImages[id] ?? null)) return true
    }
    return false
  }, [featuredIds, featuredTexts, featuredMobileImages, featuredDesktopImages, initialFeaturedIds, initialFeaturedTexts, initialFeaturedMobileImages, initialFeaturedDesktopImages])

  const featuredLimitReached = featuredIds.length > 5

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const reorder = (ids: number[], setIds: (next: number[]) => void) => (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = ids.indexOf(active.id as number)
    const newIndex = ids.indexOf(over.id as number)
    if (oldIndex < 0 || newIndex < 0) return
    setIds(arrayMove(ids, oldIndex, newIndex))
  }

  const renderList = (
    ids: number[],
    setIds: (next: number[]) => void,
    extraPerItem?: (id: number) => React.ReactNode,
  ) => (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorder(ids, setIds)}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ids.map((id) => {
            const p = productById.get(id)
            return (
              <SortableRow key={id} id={id}>
                {({ listeners, attributes }) => (
                  <>
                    <span
                      {...attributes}
                      {...listeners}
                      style={{ cursor: 'grab', color: 'var(--ant-color-text-tertiary)', paddingTop: 4 }}
                      aria-label="Перетащить"
                    >
                      <HolderOutlined />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Typography.Text strong style={{ display: 'block' }}>
                        {p?.name ?? `Товар #${id}`}
                      </Typography.Text>
                      {extraPerItem?.(id)}
                    </div>
                    <Button
                      type="text"
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => setIds(ids.filter((x) => x !== id))}
                      title="Убрать из подборки"
                    />
                  </>
                )}
              </SortableRow>
            )
          })}
        </div>
      </SortableContext>
    </DndContext>
  )

  const renderAddSelect = (
    ids: number[],
    setIds: (next: number[]) => void,
    placeholder: string,
  ) => (
    <Select
      placeholder={placeholder}
      style={{ width: '100%' }}
      value={null}
      onChange={(v) => {
        if (v == null) return
        if (!ids.includes(v as number)) setIds([...ids, v as number])
      }}
      options={productOptions.filter((opt) => !ids.includes(opt.value))}
      optionFilterProp="label"
      showSearch
      allowClear
    />
  )

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        Рекомендации
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
        Подборки товаров. Перетаскивай за «⋮⋮» для изменения порядка.
      </Typography.Paragraph>

      <Card
        title="Рекомендуем на главной"
        extra={
          <Button
            type="primary"
            size="small"
            loading={saveMenuRec.isPending}
            disabled={
              sameOrderedList(menuRec, initialMenuRec)
            }
            onClick={() => saveMenuRec.mutate()}
          >
            Сохранить
          </Button>
        }
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
          Горизонтальный скроллер над каталогом меню.
        </Typography.Paragraph>
        {renderAddSelect(menuRec, setMenuRec, 'Добавить товар…')}
        <div style={{ marginTop: 12 }}>{renderList(menuRec, setMenuRec)}</div>
      </Card>

      <Card
        title="Наши новинки"
        extra={
          <Button
            type="primary"
            size="small"
            loading={saveFeatured.isPending}
            disabled={!featuredChanged || featuredLimitReached}
            onClick={() => saveFeatured.mutate()}
          >
            Сохранить
          </Button>
        }
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
          Большая карточка-баннер на главной — листающаяся, до 5 товаров. Авто-перелистывание раз в 12 секунд.
        </Typography.Paragraph>
        {renderAddSelect(featuredIds, setFeaturedIds, 'Добавить товар…')}
        {featuredLimitReached && (
          <Typography.Text type="danger" style={{ display: 'block', marginTop: 8 }}>
            Можно выбрать не больше 5 товаров.
          </Typography.Text>
        )}
        <div style={{ marginTop: 12 }}>
          {renderList(featuredIds, setFeaturedIds, (id) => {
            const mobileImg = featuredMobileImages[id]
            const desktopImg = featuredDesktopImages[id]
            const mobileImgUrl = toDisplayUrl(mobileImg)
            const desktopImgUrl = toDisplayUrl(desktopImg)
            const mobileFileList: UploadFile[] = mobileImgUrl
              ? [{ uid: `mobile-${id}`, name: 'mobile.jpg', url: mobileImgUrl, status: 'done' }]
              : []
            const desktopFileList: UploadFile[] = desktopImgUrl
              ? [{ uid: `desktop-${id}`, name: 'desktop.jpg', url: desktopImgUrl, status: 'done' }]
              : []
            const uploadFor = (
              variant: 'mobile' | 'desktop',
              setter: React.Dispatch<React.SetStateAction<Record<number, string | null>>>,
              fileList: UploadFile[],
            ) => (
              <Upload
                name="file"
                maxCount={1}
                fileList={fileList}
                customRequest={async (options) => {
                  const { file, onError, onSuccess } = options
                  const formData = new FormData()
                  formData.append('file', file as Blob)
                  try {
                    const res = await api.post('/admin/upload', formData, {
                      headers: { 'Content-Type': 'multipart/form-data' },
                    })
                    const url = res.data.url as string
                    onSuccess?.(res.data, file as never)
                    setter((prev) => ({ ...prev, [id]: url }))
                  } catch (err: unknown) {
                    const detail =
                      (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
                    message.error(detail || 'Ошибка загрузки')
                    onError?.(err as Error)
                  }
                }}
                onRemove={() => {
                  setter((prev) => ({ ...prev, [id]: null }))
                  return true
                }}
                accept="image/*"
                listType="picture-card"
              >
                {fileList.length === 0 && (variant === 'mobile' ? '+ Mobile' : '+ Desktop')}
              </Upload>
            )
            return (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Typography.Text type="secondary" style={{ display: 'block' }}>
                  Текст под названием (показывается на баннере)
                </Typography.Text>
                <Input.TextArea
                  value={featuredTexts[id] ?? ''}
                  onChange={(e) =>
                    setFeaturedTexts((prev) => ({ ...prev, [id]: e.target.value }))
                  }
                  rows={2}
                  maxLength={200}
                  placeholder="Например: слоёный, на французском масле"
                  showCount
                />
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <div>
                    <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
                      <b>Mobile</b> · соотношение <b>1 : 1.15</b> (портрет, чуть выше квадрата). Рекомендуется 1080 × 1242 px. Если пусто — берётся обычная фотка товара.
                    </Typography.Text>
                    {uploadFor('mobile', setFeaturedMobileImages, mobileFileList)}
                    {mobileImgUrl && (
                      <AntImage
                        src={mobileImgUrl}
                        alt="mobile preview"
                        width={150}
                        style={{ borderRadius: 8, objectFit: 'cover', marginTop: 8 }}
                      />
                    )}
                  </div>
                  <div>
                    <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
                      <b>Desktop</b> · соотношение <b>2.4 : 1</b> (широкий баннер). Рекомендуется 2400 × 1000 px. Если пусто — берётся mobile-картинка.
                    </Typography.Text>
                    {uploadFor('desktop', setFeaturedDesktopImages, desktopFileList)}
                    {desktopImgUrl && (
                      <AntImage
                        src={desktopImgUrl}
                        alt="desktop preview"
                        width={240}
                        style={{ borderRadius: 8, objectFit: 'cover', marginTop: 8 }}
                      />
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <Card
        title="Рекомендуем в избранном"
        extra={
          <Button
            type="primary"
            size="small"
            loading={saveFavRec.isPending}
            disabled={sameOrderedList(favRec, initialFavRec)}
            onClick={() => saveFavRec.mutate()}
          >
            Сохранить
          </Button>
        }
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
          Блок «Попробуйте ещё» внизу листа избранного.
        </Typography.Paragraph>
        {renderAddSelect(favRec, setFavRec, 'Добавить товар…')}
        <div style={{ marginTop: 12 }}>{renderList(favRec, setFavRec)}</div>
      </Card>
    </Space>
  )
}
