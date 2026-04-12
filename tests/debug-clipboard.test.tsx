import { render, fireEvent, act } from '@testing-library/react'
import { it, vi } from 'vitest'
import { TemplateEditor } from '@/components/TemplateEditor'
import type { Template } from '@/lib/models'

const templateWithFolders: Template = {
  id: 'tmpl-2',
  name: 'With Folders',
  folders: [
    { name: 'Alpha', children: [] },
    { name: 'Beta', children: [{ name: 'Child', children: [] }] },
  ],
}

it('debug clipboard flow', async () => {
  const { container } = render(
    <TemplateEditor
      template={templateWithFolders}
      templates={[templateWithFolders]}
      saveSignal={0}
      onSave={vi.fn()}
      onDelete={vi.fn()}
      onDuplicate={vi.fn()}
      onWorkingStateChange={vi.fn()}
    />
  )
  
  const tree = container.querySelector('[tabindex="0"]') as HTMLElement
  const firstRow = container.querySelector('[data-path="0"]') as HTMLElement
  
  console.log('tree found:', !!tree)
  console.log('firstRow found:', !!firstRow)
  console.log('initial [data-path] count:', container.querySelectorAll('[data-path]').length)
  
  // Click to focus + select the first row
  await act(async () => {
    fireEvent.click(firstRow)
  })
  
  console.log('After click - [data-path] count:', container.querySelectorAll('[data-path]').length)
  
  // Cmd+C  
  await act(async () => {
    fireEvent.keyDown(tree, { key: 'c', metaKey: true })
  })
  
  console.log('After Cmd+C - [data-path] count:', container.querySelectorAll('[data-path]').length)
  
  // Cmd+V
  await act(async () => {
    fireEvent.keyDown(tree, { key: 'v', metaKey: true })
  })
  
  const finalPaths = container.querySelectorAll('[data-path]')
  console.log('After Cmd+V - [data-path] count:', finalPaths.length)
  finalPaths.forEach(el => {
    console.log('  path:', el.getAttribute('data-path'))
  })
})
