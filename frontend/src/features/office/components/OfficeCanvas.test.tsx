import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OfficeCanvas } from './OfficeCanvas'
import type { OfficeDeveloper } from '../../../types/office'

function buildDeveloper(
  overrides: Partial<OfficeDeveloper> = {},
): OfficeDeveloper {
  return {
    id: 'dev-1',
    firstName: 'Juan',
    lastName: 'Pérez',
    email: 'juan.perez@devoffice.local',
    avatarUrl: null,
    isActive: true,
    position: null,
    currentActivity: null,
    ...overrides,
  }
}

describe('OfficeCanvas', () => {
  it('renders every office area and defaults developers with no position to Escritorios', () => {
    render(
      <OfficeCanvas
        developers={[buildDeveloper()]}
        onSelectDeveloper={vi.fn()}
      />,
    )

    expect(screen.getByText('Escritorios')).toBeInTheDocument()
    expect(screen.getByText('Café')).toBeInTheDocument()
    expect(screen.getByText('Sala de reuniones')).toBeInTheDocument()
    expect(screen.getByText('Almuerzo')).toBeInTheDocument()
    expect(screen.getByText('Descanso')).toBeInTheDocument()
    expect(screen.getByText('Juan')).toBeInTheDocument()
  })

  it('groups a developer into their assigned area', () => {
    const developer = buildDeveloper({
      id: 'dev-2',
      firstName: 'Ana',
      position: {
        x: 0,
        y: 0,
        width: 64,
        height: 64,
        rotation: 0,
        area: 'coffee',
      },
    })

    render(
      <OfficeCanvas developers={[developer]} onSelectDeveloper={vi.fn()} />,
    )

    const coffeeArea = screen
      .getByText('Café')
      .closest('div[class*="MuiPaper"]')
    expect(coffeeArea).not.toBeNull()
    expect(coffeeArea).toHaveTextContent('Ana')
  })

  it('calls onSelectDeveloper when a developer avatar is clicked', async () => {
    const onSelect = vi.fn()
    const developer = buildDeveloper()
    render(
      <OfficeCanvas developers={[developer]} onSelectDeveloper={onSelect} />,
    )

    await userEvent.click(screen.getByText('Juan'))

    expect(onSelect).toHaveBeenCalledWith(developer)
  })
})
