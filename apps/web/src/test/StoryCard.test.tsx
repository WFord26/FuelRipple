import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import userEvent from '@testing-library/user-event';
import { render, screen } from './test-utils';
import StoryCard, { StoryCardData } from '../components/StoryCard';

const baseProps: StoryCardData = {
  id: 'test-story-1',
  title: 'OPEC Production Cut',
  insight: 'Prices are expected to rise',
  detail: 'OPEC agreed to cut output by 1 million barrels per day.',
  category: 'event',
  icon: '🛢️',
  color: 'blue',
};

describe('StoryCard', () => {
  it('renders title and insight', () => {
    render(<StoryCard {...baseProps} />);
    expect(screen.getByText('OPEC Production Cut')).toBeInTheDocument();
    expect(screen.getByText('Prices are expected to rise')).toBeInTheDocument();
  });

  it('renders detail text when provided', () => {
    render(<StoryCard {...baseProps} />);
    expect(screen.getByText('OPEC agreed to cut output by 1 million barrels per day.')).toBeInTheDocument();
  });

  it('does not render detail when not provided', () => {
    const { container } = render(<StoryCard {...baseProps} detail={undefined} />);
    expect(container.querySelector('p.text-xs')).toBeNull();
  });

  it('renders category badge', () => {
    
    render(<StoryCard {...baseProps} />);
    expect(screen.getByText('Event')).toBeInTheDocument();
  });

  it('renders category badge for market type', () => {
    render(<StoryCard {...baseProps} category="market" />);
    expect(screen.getByText('Market')).toBeInTheDocument();
  });

  it('renders category badge for supply type', () => {
    render(<StoryCard {...baseProps} category="supply" />);
    expect(screen.getByText('Supply')).toBeInTheDocument();
  });

  it('renders category badge for correlation type', () => {
    render(<StoryCard {...baseProps} category="correlation" />);
    expect(screen.getByText('Correlation')).toBeInTheDocument();
  });

  it('renders icon', () => {
    render(<StoryCard {...baseProps} />);
    expect(screen.getByText('🛢️')).toBeInTheDocument();
  });

  it('renders date when provided', () => {
    render(<StoryCard {...baseProps} date="Jan 15" />);
    expect(screen.getByText('Jan 15')).toBeInTheDocument();
  });

  it('renders action button when actionLabel and onAction provided', () => {
    const onAction = vi.fn();
    render(<StoryCard {...baseProps} actionLabel="View details" onAction={onAction} />);
    const button = screen.getByText('View details →');
    expect(button).toBeInTheDocument();
  });

  it('calls onAction when action button is clicked', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<StoryCard {...baseProps} actionLabel="View details" onAction={onAction} />);
    await user.click(screen.getByText('View details →'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('calls onAction when card is clicked', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<StoryCard {...baseProps} onAction={onAction} />);
    await user.click(screen.getByRole('article'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('does not render action button when only actionLabel but no onAction', () => {
    render(<StoryCard {...baseProps} actionLabel="View details" />);
    expect(screen.queryByText('View details →')).toBeNull();
  });
});
