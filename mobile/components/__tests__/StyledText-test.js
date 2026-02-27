import * as React from 'react';
import renderer from 'react-test-renderer';

import { MonoText } from '../StyledText';

it(`renders correctly`, () => {
  const tree = renderer.create(<MonoText>Snapshot test!</MonoText>).toJSON();
  expect(tree).toMatchSnapshot();
});

it('renders MonoText with child text content', () => {
  const tree = renderer.create(<MonoText>hello world</MonoText>).toJSON();
  // react-test-renderer returns an object with children array for native Text
  expect(tree.children).toContain('hello world');
});

it('applies custom style props correctly to MonoText', () => {
  const style = { fontSize: 20, color: 'red' };
  const tree = renderer.create(<MonoText style={style}>styled</MonoText>).toJSON();
  // style is merged in Themed.Text as [{ color }, style] and in MonoText as [props.style, { fontFamily: 'SpaceMono' }]
  // In snapshots, styles may be flattened; ensure fontFamily is present via snapshot and color maintained
  expect(tree).toMatchSnapshot();
});

it('renders with default props when none are provided', () => {
  const tree = renderer.create(<MonoText />).toJSON();
  // Should render a Text node even with no children
  expect(tree.type).toBe('Text');
});

it('renders multiple nested children correctly', () => {
  const tree = renderer
    .create(
      <MonoText>
        {'one'}
        {' '}
        {'two'}
      </MonoText>
    )
    .toJSON();
  expect(tree.children).toEqual(['one', ' ', 'two']);
});

it('matches snapshot for styled MonoText with props', () => {
  const tree = renderer
    .create(
      <MonoText style={{ fontSize: 16 }} lightColor="#333" darkColor="#eee">
        themed
      </MonoText>
    )
    .toJSON();
  expect(tree).toMatchSnapshot();
});
