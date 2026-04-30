import React from 'react'
import { BUTLeftIconWideButton, BUTWideButton } from '../../buttons'
import './PageTopHeader.css'

type ActionButtonMode = 'text' | 'iconText' | 'icon'

interface PageTopHeaderActionButton {
  to?: string
  onClick?: React.MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>
  label?: string
  mode?: ActionButtonMode
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
  ariaLabel?: string
  className?: string
}

interface PageTopHeaderProps {
  title: string
  subtitle?: React.ReactNode
  className?: string
  innerClassName?: string
  actionButton?: PageTopHeaderActionButton
  actionContent?: React.ReactNode
}

const PageTopHeader: React.FC<PageTopHeaderProps> = ({
  title,
  subtitle,
  className = '',
  innerClassName = '',
  actionButton,
  actionContent
}) => {
  const headerClassName = ['rs-page-top-header', className].filter(Boolean).join(' ')
  const innerClassNameCombined = ['rs-page-top-header__inner', innerClassName].filter(Boolean).join(' ')
  const buttonLabel = actionButton?.label ?? 'Back'
  const buttonMode = actionButton?.mode ?? 'text'
  const buttonChildren = buttonMode === 'icon' ? undefined : buttonLabel
  const shouldUseIconButton = buttonMode !== 'text' && Boolean(actionButton?.icon)

  return (
    <header className={headerClassName}>
      <div className={innerClassNameCombined}>
        <div className="rs-page-top-header__copy">
          <h1 className="rs-page-top-header__title">{title}</h1>
          {subtitle ? <p className="rs-page-top-header__subtitle">{subtitle}</p> : null}
          {actionButton ? (
            shouldUseIconButton ? (
              <BUTLeftIconWideButton
                to={actionButton.to}
                onClick={actionButton.onClick}
                width="hug"
                className={['rs-page-top-header__action', actionButton.className].filter(Boolean).join(' ')}
                icon={actionButton.icon}
                ariaLabel={actionButton.ariaLabel ?? (buttonMode === 'icon' ? buttonLabel : undefined)}
              >
                {buttonChildren}
              </BUTLeftIconWideButton>
            ) : (
              <BUTWideButton
                to={actionButton.to}
                onClick={actionButton.onClick}
                width="hug"
                className={['rs-page-top-header__action', actionButton.className].filter(Boolean).join(' ')}
                ariaLabel={actionButton.ariaLabel ?? (buttonMode === 'icon' ? buttonLabel : undefined)}
              >
                {buttonChildren}
              </BUTWideButton>
            )
          ) : null}
          {actionContent ? (
            <div className="rs-page-top-header__actions-row">
              {actionContent}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}

export default PageTopHeader
