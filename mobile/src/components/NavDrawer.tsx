import { useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Circle, Path, Svg } from 'react-native-svg';

import type { SlidePanelController } from '../lib/useSlidePanel';
import { FONTS, type ThemeColors, useTheme } from '../theme';
import { Chevron, CompassRose, CornerFlourish, Flourish, OrnamentRule, SectionGlyph,
  type SectionGlyphName } from './DrawerOrnaments';
import Icon from './Icon';
import SlidePanel from './SlidePanel';

// Ports the PWA's hamburger drawer (index.html: #header-menu-btn / #header-actions,
// the .hdr-section collapsible groups). Discover/Manage/Assist & Project mirror the
// PWA's three sections, item order, and icons (react-native-svg re-render of the exact
// same <symbol> paths, see Icon.tsx) exactly. Most items point at PWA features that
// don't have a mobile screen yet (see CLAUDE.md's mobile roadmap / handoff doc §14.6)
// -- those render disabled with a "coming soon" tap response rather than being hidden,
// so the menu's shape matches the PWA today and items switch on as their screens land.
type SectionKey = 'discover' | 'manage' | 'assist';

// The reference sets a drawn mark beside each group -- a compass, stacked books, a quill.
const SECTION_GLYPH: Record<SectionKey, SectionGlyphName> = {
  discover: 'discover',
  manage: 'manage',
  assist: 'assist',
};

type DrawerItem = {
  key: string;
  icon: string;
  label: string;
  badge?: number;
  onPress?: () => void;
};

const DISCOVER: DrawerItem[] = [
  { key: 'search', icon: 'search', label: 'Search' },
  { key: 'pov', icon: 'eye', label: 'POV' },
  { key: 'continuity', icon: 'link', label: 'Continuity check' },
  { key: 'ledger', icon: 'book-open', label: 'Ledger' },
  { key: 'mythic', icon: 'compass', label: 'Mythic Threads' },
  { key: 'documents', icon: 'books', label: 'Documents' },
  { key: 'assistant', icon: 'sparkle', label: 'Assistant' },
  { key: 'braid', icon: 'link', label: 'The Braid' },
];

const MANAGE: DrawerItem[] = [
  { key: 'epub', icon: 'books', label: 'Export as eBook' },
  { key: 'trash', icon: 'trash', label: 'Trash' },
  { key: 'export', icon: 'download', label: 'Export' },
  { key: 'export-epub', icon: 'book-closed', label: 'Export as eBook' },
  { key: 'import', icon: 'upload', label: 'Import' },
  { key: 'read', icon: 'bookmark', label: 'Read' },
  { key: 'notes', icon: 'pin', label: 'Pages' },
  { key: 'treatments', icon: 'book-open', label: 'Treatments' },
  { key: 'trash', icon: 'trash', label: 'Trash' },
];

function CompassIcon({ color, size = 34 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Path d="M20 2 L23.5 17 L38 20 L23.5 23 L20 38 L16.5 23 L2 20 L16.5 17 Z" stroke={color} strokeWidth={1.2} fill="none" />
      <Circle cx={20} cy={20} r={12} stroke={color} strokeWidth={1} fill="none" />
      <Circle cx={20} cy={20} r={2.5} fill={color} />
    </Svg>
  );
}

function comingSoon(label: string) {
  Alert.alert(label, 'Not built yet on mobile — coming in a later pass.');
}

export default function NavDrawer({
  controller,
  panelWidth,
  projectName,
  onSearch,
  onSwitchProject,
  onSignOut,
  onOpenReader,
  onOpenSettings,
  onOpenNotes,
  onOpenTreatments,
  onOpenDocuments,
  onOpenAssistant,
  onOpenBraid,
  onOpenTrash,
  onExportEpub,
}: {
  controller: SlidePanelController;
  panelWidth: number;
  projectName: string;
  onSearch: () => void;
  onSwitchProject: () => void;
  onSignOut: () => void;
  onOpenReader: () => void;
  onOpenSettings: () => void;
  onOpenNotes: () => void;
  onOpenTreatments: () => void;
  onOpenDocuments: () => void;
  onOpenAssistant: () => void;
  onOpenBraid: () => void;
  onOpenTrash: () => void;
  onExportEpub: () => void;
}) {
  const [expanded, setExpanded] = useState<Set<SectionKey>>(new Set());
  const { colors, mode } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const onClose = controller.close;

  function toggleSection(key: SectionKey) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const discoverItems = DISCOVER.map((item) => {
    if (item.key === 'search') return { ...item, onPress: onSearch };
    if (item.key === 'documents') return { ...item, onPress: onOpenDocuments };
    if (item.key === 'assistant') return { ...item, onPress: onOpenAssistant };
    if (item.key === 'braid') return { ...item, onPress: onOpenBraid };
    if (item.key === 'trash') return { ...item, onPress: onOpenTrash };
    if (item.key === 'epub') return { ...item, onPress: onExportEpub };
    return item;
  });

  const manageItems = MANAGE.map((item) => {
    if (item.key === 'read') return { ...item, onPress: onOpenReader };
    if (item.key === 'notes') return { ...item, onPress: onOpenNotes };
    if (item.key === 'treatments') return { ...item, onPress: onOpenTreatments };
    return item;
  });

  const ASSIST: DrawerItem[] = [
    { key: 'switch-project', icon: 'swap', label: 'Switch project', onPress: onSwitchProject },
    { key: 'settings', icon: 'gear', label: 'Settings', onPress: onOpenSettings },
    { key: 'sign-out', icon: 'exit', label: 'Sign out', onPress: onSignOut },
  ];

  return (
    <SlidePanel controller={controller} width={panelWidth}>
      <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={10}>
        <Text style={styles.closeBtnText}>✕</Text>
      </Pressable>

      <View pointerEvents="none" style={styles.cornerTL}>
        <CornerFlourish corner="tl" color={colors.railInk} />
      </View>
      <View pointerEvents="none" style={styles.cornerTR}>
        <CornerFlourish corner="tr" color={colors.railInk} />
      </View>

      <ScrollView contentContainerStyle={styles.panelContent} showsVerticalScrollIndicator={false}>
        <View style={styles.brand}>
          {/* The full rose, not the small nav glyph: in the reference this is the panel's
              one large drawn object and everything below is deliberately quieter than it. */}
          <CompassRose size={92} color={colors.railInk} />
          <Text style={styles.brandTitle}>{projectName}</Text>
          <Text style={styles.brandSubtitle}>STORYMAP</Text>
        </View>
        <View style={styles.dividerWrap}>
          <OrnamentRule color={colors.railDim} />
        </View>

        <Section
          title="Discover"
          sectionKey="discover"
          expanded={expanded.has('discover')}
          onToggle={toggleSection}
          items={discoverItems}
          colors={colors}
          styles={styles}
        />
        <Section
          title="Manage"
          sectionKey="manage"
          expanded={expanded.has('manage')}
          onToggle={toggleSection}
          items={manageItems}
          colors={colors}
          styles={styles}
        />
        <Section
          title="Assist & Project"
          sectionKey="assist"
          expanded={expanded.has('assist')}
          onToggle={toggleSection}
          items={ASSIST}
          colors={colors}
          styles={styles}
        />

        {/* Double-ruled frame with a star at top and bottom, as in the reference. */}
        <View style={styles.epigraphBox}>
          <View style={styles.epigraphInner}>
            <Text style={styles.epigraphText}>Chart the past.{'\n'}Shape the future.{'\n'}Leave your legend.</Text>
          </View>
          <View style={styles.epigraphStar}>
            <Flourish size={13} color={colors.railInk} />
          </View>
        </View>

        {/* The illustrated city. Bled off the bottom and both sides, anchored low, with the
            sky cropped away at build time -- the drawer supplies its own parchment above it,
            so every row of sky in the file would have been payload spent on nothing.
            `cover` rather than `contain`: the picture is a foot to the panel, not a framed
            plate, and it should run off the edges the way it does in the reference. */}
        {mode === 'night' && (
          <Image source={require('../../assets/drawer-city.webp')} style={styles.art} resizeMode="cover" />
        )}
      </ScrollView>
    </SlidePanel>
  );
}

function Section({
  title,
  sectionKey,
  expanded,
  onToggle,
  items,
  colors,
  styles,
}: {
  title: string;
  sectionKey: SectionKey;
  expanded: boolean;
  onToggle: (key: SectionKey) => void;
  items: DrawerItem[];
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.section}>
      <Pressable style={styles.sectionLabel} onPress={() => onToggle(sectionKey)}>
        <View style={styles.sectionGlyph}>
          <SectionGlyph name={SECTION_GLYPH[sectionKey]} color={colors.railInk} size={26} />
        </View>
        <Text style={styles.sectionLabelText}>{title.toUpperCase()}</Text>
        <View style={styles.sectionRuleWrap}>
          <OrnamentRule color={colors.railDim} />
        </View>
        <Chevron color={colors.railInk} size={15} open={expanded} />
      </Pressable>

      {expanded &&
        items.map((item) => (
          <Pressable
            key={item.key}
            style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
            onPress={item.onPress ?? (() => comingSoon(item.label))}
          >
            <View style={styles.itemIcon}>
              <Icon name={item.icon} size={17} color={item.onPress ? colors.gold : colors.textFaint} />
            </View>
            <Text style={[styles.itemLabel, !item.onPress && styles.itemLabelDisabled]}>{item.label}</Text>
            {!!item.badge && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.badge}</Text>
              </View>
            )}
          </Pressable>
        ))}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    closeBtn: {
      position: 'absolute',
      top: 14,
      right: 14,
      zIndex: 1,
      width: 34,
      height: 34,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.railDim,
      backgroundColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeBtnText: { color: colors.railInk, fontSize: 15 },
    panelContent: { padding: 24, paddingTop: 32, paddingBottom: 40, flexGrow: 1 },
    brand: { alignItems: 'center', marginBottom: 16 },
    brandTitle: { color: colors.gold, fontFamily: FONTS.heading, fontSize: 20, letterSpacing: 1.5, marginTop: 8 },
    brandSubtitle: { color: colors.railDim, fontFamily: FONTS.heading, fontSize: 11, letterSpacing: 3, marginTop: 4 },
    divider: { height: 1, backgroundColor: colors.railDim, marginBottom: 20 },
    dividerWrap: { marginBottom: 18, paddingHorizontal: 4 },
    cornerTL: { position: 'absolute', top: 10, left: 10, zIndex: 2 },
    cornerTR: { position: 'absolute', top: 10, right: 10, zIndex: 2 },
    sectionGlyph: { width: 30, alignItems: 'center', marginRight: 6 },
    sectionRuleWrap: { flex: 1, marginHorizontal: 10, justifyContent: 'center' },
    // The epigraph is double-ruled with a star hung below it, so the outer view carries the
    // second rule and the inner one the first.
    epigraphInner: {
      borderWidth: 1,
      borderColor: colors.railDim,
      paddingVertical: 16,
      paddingHorizontal: 18,
    },
    epigraphStar: { alignItems: 'center', marginTop: -7, backgroundColor: 'transparent' },
    // Full bleed: negative margins cancel the panel's own padding so the picture reaches
    // the edges. Its own top edge is the same cream as the rail, so no fade is needed --
    // they meet exactly, which is why the rail took the artwork's colour rather than the
    // artwork taking the rail's.
    // The slot's aspect ratio is FIXED at 3:2 and the supplied art must match it, or `cover`
    // will crop one axis to fill the other. Full drawer width is 360dp, so the picture is
    // 360 x 240dp -- 1080 x 720px at 3x. Negative margins cancel the panel's 24dp padding so
    // it reaches the edges; -26 rather than -24 because a hairline of parchment at the very
    // edge reads as a border and the whole point is that it does not have one.
    art: {
      width: undefined,
      alignSelf: 'stretch',
      aspectRatio: 3 / 2,
      marginTop: 26,
      marginHorizontal: -26,
      marginBottom: -42,
    },
    section: { marginBottom: 4 },
    sectionLabel: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10 },
    sectionLabelText: { color: colors.gold, fontFamily: FONTS.heading, fontSize: 12, letterSpacing: 2 },
    sectionRule: { flex: 1, height: 1, backgroundColor: colors.railDim },
    sectionArrow: { color: colors.gold, fontSize: 12, transform: [{ rotate: '0deg' }] },
    sectionArrowOpen: { transform: [{ rotate: '90deg' }] },
    item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingLeft: 8, gap: 14 },
    itemPressed: { backgroundColor: 'rgba(120,100,60,0.12)' },
    itemIcon: { width: 22, alignItems: 'center' },
    itemLabel: { color: colors.railInk, fontSize: 14.5, letterSpacing: 0.5, flex: 1 },
    itemLabelDisabled: { color: colors.railDim },
    badge: {
      backgroundColor: colors.gold,
      borderRadius: 9,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: { color: colors.bg, fontFamily: FONTS.monoMedium, fontSize: 10.5 },
    // Two rules, not one: the outer box draws the first and epigraphInner the second, with
    // 4px between them. A single border with a thicker stroke reads as a heavier box; two
    // hairlines read as an engraved frame, which is what the reference is doing.
    epigraphBox: {
      marginTop: 28,
      borderWidth: 1,
      borderColor: colors.railDim,
      padding: 4,
    },
    epigraphText: { color: colors.railDim, fontFamily: FONTS.literaryItalic, fontSize: 12.5, textAlign: 'center', lineHeight: 20 },
  });
}
