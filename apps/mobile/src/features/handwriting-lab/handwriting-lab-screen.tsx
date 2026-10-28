// Ported from apps/web/src/features/handwriting-lab/handwriting-lab-page.tsx @ 4b16671 (working tree:
// Phase 54, AI-13 stage 0). The Handwriting lab: a platform admin writes maths on the canvas, one step a
// line; each line is read on its own, blind, and what was read appears beside the page. Confirming or
// correcting a reading saves the line as a sample, and the samples are the corpus the reader is measured
// against (`npm run handwriting:eval`). Adults' handwriting only: no child's work is read until consent
// for AI processing exists (AG1).
// Mobile (design #64): pushed over the console's tabs from Questions. On a wide screen (an iPad on its
// side) the page never scrolls and the panel beside it does; on a phone everything is one scroll, the
// page taking touches as writing (`scrollRef`). The swipe back is off, so a stroke from the left edge
// never leaves the lab.
import {
  CANVAS_LIMITS,
  HANDWRITING_SAMPLE_CATEGORIES,
  HANDWRITING_SAMPLE_CATEGORY_LABELS,
  saveHandwritingSampleSchema,
  type CanvasStroke,
  type HandwritingSampleCategory,
} from '@tmi/shared';
import { useCallback, useReducer, useRef, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Button, Icon, Menu, Text, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FieldError } from '@/components/field-error';
import { IconButton } from '@/components/icon-button';
import { PageIntro } from '@/components/page-intro';
import { Screen } from '@/components/screen';
import { useToast } from '@/components/toast';
import { DrawingCanvas } from '@/features/canvas-assessments/drawing-canvas';
import { fitCanvas, type CanvasTool } from '@/features/canvas-assessments/drawing-model';
import { errorMessage } from '@/features/question-bank/question-card';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import { radius, space } from '@/theme/tokens';
import { readHandwriting, useSaveHandwritingSample } from './api';
import {
  EMPTY_PAGE,
  RULES,
  labReducer,
  pageFits,
  pngSize,
  readingModel,
  sampleInput,
  savedToast,
  syntheticLine,
} from './lab-model';
import type { LineState } from './line-reader-model';
import { MathLine } from './math-line';
import { CODE_FONT, ReadingPanel } from './reading-panel';
import { SamplesCard } from './samples-card';
import { useLineReader } from './use-line-reader';

const INTRO =
  "Write maths one step per line. Each line is read on its own, without the question or the answer, and what was read appears beside the page. Confirm or correct a reading to keep the line as a sample: the samples measure the reader before any student's work is read. Adults' handwriting only.";

/** The page's faint rules, and where each line was found, numbered as in the panel. */
function PageMarks({ lines, highlighted }: { lines: LineState[]; highlighted: number | null }) {
  const theme = useAppTheme();
  return (
    <>
      {Array.from({ length: RULES - 1 }, (_, i) => (
        <View
          key={`rule-${i}`}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: `${((i + 1) / RULES) * 100}%`,
            height: StyleSheet.hairlineWidth * 2,
            backgroundColor: theme.colors.outlineVariant,
          }}
        />
      ))}
      {lines.map(({ line }) => (
        <View
          key={line.key}
          testID={`lab-line-${line.index + 1}`}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: `${(line.top / CANVAS_LIMITS.height) * 100}%`,
            height: `${((line.bottom - line.top) / CANVAS_LIMITS.height) * 100}%`,
            borderRadius: radius.sm,
            backgroundColor: highlighted === line.index ? withAlpha(theme.colors.primary, 0.1) : 'transparent',
          }}
        >
          <View
            style={{
              position: 'absolute',
              top: 0,
              right: 4,
              width: 20,
              height: 20,
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.tokens.muted,
            }}
          >
            <Text style={{ fontSize: 10, lineHeight: 12, fontWeight: '700', color: theme.tokens.mutedForeground }}>
              {String(line.index + 1)}
            </Text>
          </View>
        </View>
      ))}
    </>
  );
}

function CategoryPicker({
  value,
  onChange,
}: {
  value: HandwritingSampleCategory;
  onChange: (value: HandwritingSampleCategory) => void;
}) {
  const theme = useAppTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: space.xs }}>
      <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
        Saving lines as
      </Text>
      <Menu
        visible={open}
        onDismiss={() => setOpen(false)}
        anchor={
          <Button
            testID="lab-category"
            mode="outlined"
            icon="chevron-down"
            contentStyle={{ flexDirection: 'row-reverse', justifyContent: 'space-between', minHeight: 44 }}
            accessibilityLabel={`Saving lines as: ${HANDWRITING_SAMPLE_CATEGORY_LABELS[value]}`}
            onPress={() => setOpen(true)}
          >
            {HANDWRITING_SAMPLE_CATEGORY_LABELS[value]}
          </Button>
        }
      >
        {HANDWRITING_SAMPLE_CATEGORIES.map((category) => (
          <Menu.Item
            key={category}
            testID={`lab-category-${category}`}
            title={HANDWRITING_SAMPLE_CATEGORY_LABELS[category]}
            leadingIcon={category === value ? 'check' : undefined}
            onPress={() => {
              setOpen(false);
              haptics.selection();
              onChange(category);
            }}
          />
        ))}
      </Menu>
    </View>
  );
}

export function HandwritingLabScreen() {
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [page, dispatch] = useReducer(labReducer, EMPTY_PAGE);
  const [tool, setTool] = useState<CanvasTool>('pen');
  const [category, setCategory] = useState<HandwritingSampleCategory>('clear');
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const [synthetic, setSynthetic] = useState(0);
  /** Line keys saved as samples, so a line is not saved twice by accident. */
  const [saved, setSaved] = useState<Record<string, true>>({});
  const [area, setArea] = useState({ width: 0, height: 0 });
  const strokes = page.strokes;
  const reader = useLineReader(strokes, { read: readHandwriting, includeImage: true });
  const model = readingModel(reader.source);

  const addStrokes = useCallback(
    (added: CanvasStroke[]) => {
      if (!pageFits(strokes, added)) {
        toast.error('The page is full. Clear it to write more.');
        return false;
      }
      dispatch({ type: 'add', strokes: added });
      return true;
    },
    [strokes, toast],
  );
  const onStroke = useCallback((stroke: CanvasStroke) => addStrokes([stroke]), [addStrokes]);
  const onErase = useCallback((hit: CanvasStroke[]) => dispatch({ type: 'erase', hit }), []);

  function writeSyntheticLine() {
    haptics.selection();
    const added = syntheticLine(strokes, synthetic, Date.now());
    if (!added) {
      toast.error('Every line of the page has writing. Clear it to write more.');
      return;
    }
    setSynthetic((n) => n + 1);
    addStrokes(added);
  }

  function chooseTool(next: CanvasTool) {
    haptics.selection();
    setTool(next);
  }

  function onArea(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    setArea((was) =>
      Math.round(was.width) === Math.round(width) && Math.round(was.height) === Math.round(height)
        ? was
        : { width, height },
    );
  }

  // An iPad on its side (or any wide screen): the page beside the panel, as on the web's large screens.
  const wide = window.width >= 700 && window.width > window.height;
  const canvas = wide
    ? fitCanvas(area.width, area.height)
    : fitCanvas(window.width - 2 * space.lg, window.height * 0.6);

  const tools = (
    <View accessibilityRole="toolbar" accessibilityLabel="Writing tools" style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
        <Button
          testID="lab-pen"
          compact
          icon="pen"
          mode={tool === 'pen' ? 'contained' : 'outlined'}
          accessibilityState={{ selected: tool === 'pen' }}
          onPress={() => chooseTool('pen')}
        >
          Pen
        </Button>
        <Button
          testID="lab-eraser"
          compact
          icon="eraser"
          mode={tool === 'eraser' ? 'contained' : 'outlined'}
          accessibilityState={{ selected: tool === 'eraser' }}
          onPress={() => chooseTool('eraser')}
        >
          Eraser
        </Button>
        <View style={{ flex: 1 }} />
        <IconButton
          testID="lab-undo"
          icon="undo"
          accessibilityLabel="Undo"
          disabled={page.history.length === 0}
          onPress={() => dispatch({ type: 'undo' })}
        />
        <IconButton
          testID="lab-clear"
          icon="delete-outline"
          accessibilityLabel="Clear page"
          disabled={strokes.length === 0}
          onPress={() => dispatch({ type: 'clear' })}
        />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        <Button
          testID="lab-write-sample"
          compact
          mode="outlined"
          icon="auto-fix"
          accessibilityHint="Writes a line in the synthetic hand: no pen needed"
          onPress={writeSyntheticLine}
        >
          Write a sample line
        </Button>
        <Button
          testID="lab-read-now"
          compact
          mode="outlined"
          icon="refresh"
          disabled={reader.lines.length === 0}
          onPress={() => void reader.readNow()}
        >
          Read now
        </Button>
      </View>
    </View>
  );

  const surface =
    canvas.width > 0 ? (
      <View testID="lab-page" style={{ alignSelf: 'center' }}>
        <DrawingCanvas
          testID="lab-canvas"
          strokes={strokes}
          tool={tool}
          width={canvas.width}
          height={canvas.height}
          onStroke={onStroke}
          onErase={onErase}
          label="Handwriting lab page"
          scrollRef={wide ? undefined : scrollRef}
          underlay={<PageMarks lines={reader.lines} highlighted={highlighted} />}
        />
      </View>
    ) : null;

  const panel = (
    <>
      <CategoryPicker value={category} onChange={setCategory} />
      <ReadingPanel
        lines={reader.lines}
        source={reader.source}
        highlighted={highlighted}
        onHighlight={setHighlighted}
        showNonMath
        renderActions={(state) => (
          <LineActions
            key={state.line.key}
            state={state}
            strokes={strokes}
            category={category}
            model={model}
            saved={Boolean(saved[state.line.key])}
            onSaved={() => setSaved((s) => ({ ...s, [state.line.key]: true }))}
            onReadAgain={() => void reader.readAgain(state.line)}
          />
        )}
      />
      <SamplesCard />
    </>
  );

  if (wide) {
    return (
      <Screen
        testID="screen-handwriting-lab"
        scroll={false}
        contentStyle={{ gap: space.sm, paddingTop: space.sm, paddingBottom: space.sm + insets.bottom }}
      >
        <View style={{ flex: 1, flexDirection: 'row', gap: space.lg }}>
          <View style={{ flex: 1, gap: space.sm }}>
            {tools}
            <View style={{ flex: 1, justifyContent: 'center' }} onLayout={onArea}>
              {surface}
            </View>
          </View>
          <ScrollView
            style={{ width: Math.max(300, Math.min(400, window.width * 0.34)), flexGrow: 0 }}
            contentContainerStyle={{ gap: space.md, paddingBottom: space.xl }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            automaticallyAdjustKeyboardInsets
          >
            <PageIntro>{INTRO}</PageIntro>
            {panel}
          </ScrollView>
        </View>
      </Screen>
    );
  }

  return (
    <Screen testID="screen-handwriting-lab" scrollRef={scrollRef} contentStyle={{ gap: space.md }}>
      <PageIntro>{INTRO}</PageIntro>
      {tools}
      {surface}
      {panel}
    </Screen>
  );
}

/** Under each line in the lab: it was read right, or here is what it says; and the picture the reader saw. */
function LineActions({
  state,
  strokes,
  category,
  model,
  saved,
  onSaved,
  onReadAgain,
}: {
  state: LineState;
  strokes: readonly CanvasStroke[];
  category: HandwritingSampleCategory;
  model: string | null;
  saved: boolean;
  onSaved: () => void;
  onReadAgain: () => void;
}) {
  const theme = useAppTheme();
  const toast = useToast();
  const save = useSaveHandwritingSample();
  const [fixing, setFixing] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [showImage, setShowImage] = useState(false);
  const { reading, pending, line } = state;
  if (!reading || pending) return null;
  const number = line.index + 1;

  function keep(truth: string) {
    const input = sampleInput(line, strokes, reading!, truth, category, model);
    // The shared schema first: an empty or SSN-shaped line never leaves the phone.
    const checked = saveHandwritingSampleSchema.safeParse(input);
    if (!checked.success) {
      const issue = checked.error.issues.find((i) => i.path[0] === 'truth') ?? checked.error.issues[0];
      const message = issue?.message ?? 'Say what the line says.';
      if (fixing !== null) setFieldError(message);
      else toast.error(message);
      return;
    }
    setFieldError(null);
    save.mutate(input, {
      onSuccess: (sample) => {
        toast.success(savedToast(number, sample.matched));
        setFixing(null);
        onSaved();
      },
      onError: (error) => {
        const truthError = error instanceof ApiRequestError ? error.fieldErrors.truth : undefined;
        if (truthError && fixing !== null) setFieldError(truthError);
        else toast.error(errorMessage(error));
      },
    });
  }

  if (saved) {
    return (
      <View
        testID={`line-saved-${number}`}
        accessible
        accessibilityLabel="Saved as a sample"
        style={{
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.xs,
          backgroundColor: theme.tokens.secondary,
          borderRadius: radius.sm,
          paddingHorizontal: space.sm,
          paddingVertical: 2,
        }}
      >
        <Icon source="check" size={14} color={theme.tokens.secondaryForeground} />
        <Text variant="labelMedium" style={{ color: theme.tokens.secondaryForeground }}>
          Saved as a sample
        </Text>
      </View>
    );
  }

  // The picture is most use while correcting a misreading, so it is offered in both states.
  const pictureButton = reading.image ? (
    <IconButton
      testID={`line-picture-${number}`}
      icon={showImage ? 'image' : 'image-outline'}
      size={20}
      selected={showImage}
      accessibilityLabel="What the reader saw"
      accessibilityState={{ selected: showImage }}
      onPress={() => {
        haptics.selection();
        setShowImage((v) => !v);
      }}
    />
  ) : null;
  const shape = reading.image ? pngSize(reading.image) : null;
  const preview = fixing?.trim() ?? '';

  return (
    <View style={{ gap: space.sm }}>
      {fixing === null ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs }}>
          {reading.status === 'read' && reading.latex !== null ? (
            <Button
              testID={`line-right-${number}`}
              compact
              mode="outlined"
              icon="check"
              disabled={save.isPending}
              onPress={() => keep(reading.latex!)}
            >
              Right
            </Button>
          ) : null}
          <Button
            testID={`line-fix-${number}`}
            compact
            mode="outlined"
            icon="pencil-outline"
            onPress={() => {
              haptics.selection();
              setFieldError(null);
              setFixing(reading.latex ?? '');
            }}
          >
            {reading.status === 'read' ? 'Not what I wrote' : 'Say what it says'}
          </Button>
          {reading.status !== 'read' ? (
            <Button testID={`line-read-again-${number}`} compact mode="text" icon="refresh" onPress={onReadAgain}>
              Read again
            </Button>
          ) : null}
          {pictureButton}
        </View>
      ) : (
        <View style={{ gap: space.sm }}>
          <TextInput
            testID={`line-truth-${number}`}
            mode="outlined"
            dense
            label={`What line ${number} says, in LaTeX (\\frac{3}{4}, \\times, x^{2})`}
            value={fixing}
            onChangeText={(text) => {
              setFixing(text);
              if (fieldError) setFieldError(null);
            }}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            autoComplete="off"
            returnKeyType="done"
            onSubmitEditing={() => {
              if (preview) keep(preview);
            }}
            error={fieldError !== null}
            contentStyle={{ fontFamily: CODE_FONT }}
          />
          {fieldError ? <FieldError>{fieldError}</FieldError> : null}
          {preview ? (
            <View testID={`line-preview-${number}`} accessible accessibilityLabel={`Preview: ${preview}`}>
              <MathLine latex={preview} size={16} />
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs }}>
            <Button
              testID={`line-save-${number}`}
              compact
              mode="contained"
              disabled={save.isPending || !preview}
              loading={save.isPending}
              onPress={() => keep(preview)}
            >
              Save sample
            </Button>
            <Button
              testID={`line-cancel-${number}`}
              compact
              mode="text"
              onPress={() => {
                setFieldError(null);
                setFixing(null);
              }}
            >
              Cancel
            </Button>
            {pictureButton}
          </View>
        </View>
      )}
      {showImage && reading.image ? (
        <Image
          testID={`line-image-${number}`}
          source={{ uri: reading.image }}
          accessibilityLabel={`The picture of line ${number} the reader was given`}
          resizeMode="contain"
          style={{
            width: '100%',
            aspectRatio: shape ? shape.width / shape.height : 4,
            maxHeight: 220,
            borderRadius: radius.sm,
            borderWidth: 1,
            borderColor: theme.colors.outlineVariant,
          }}
        />
      ) : null}
    </View>
  );
}
