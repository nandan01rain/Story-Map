import { useMemo, useState } from 'react';
import { useEffect } from 'react';
import * as NavigationBar from 'expo-navigation-bar';
import {
  Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
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
//
// DAY AND NIGHT ARE NOW THE SAME LAYOUT (2026-09-05). Both modes are two supplied plates --
// a header carried at the top of the scroll flow and a city pinned to the foot -- differing
// only in which files they name. Day used to be ONE full-height plate with the live text
// printed into gaps measured from it, which forced a fixed scroll window, a percentage-based
// title band and a 15% inset to keep type off the vines running the whole height. None of
// that survives the split: the menu sits on plain rail between two pictures, so it can be
// laid out like any other list.
//
// The header files are cropped at build time to their last fully opaque row -- the generator
// left a ragged alpha fade below it -- so their bottom edge is flat parchment and the panel
// colour is sampled from that edge (theme.ts). No gradient, no seam.
const HEADER_RATIO = 1080 / 531;   // the cropped plates' own aspect, not a chosen number
const CITY_RATIO = 3 / 2;
// The header's clear band, measured by scanning the cropped plate for ink: the rose ends at
// 63%, STORYMAP runs 67-71%, the rule 73-78%, and everything below 78.2% is bare parchment.
// The project title is printed into that band.
const TITLE_BAND = 0.218;
// The plates' vine borders eat roughly a tenth of the width on each side. Only the title
// has to clear them now -- the menu sits on plain rail between the two pictures, so the 15%
// inset the single full-height plate forced on every row is gone with it.
const TITLE_INSET = 0.12;

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

  // The drawer runs the full height of the screen and its artwork reaches the bottom edge, so
  // the navigation bar sits directly on the city. Hidden while the panel is mounted, restored
  // when it closes -- the same treatment the braid gets, and for the same reason: the picture
  // goes all the way down or it is not the picture.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    NavigationBar.setVisibilityAsync('hidden').catch(() => {});
    return () => {
      NavigationBar.setVisibilityAsync('visible').catch(() => {});
    };
  }, []);
  const { colors, mode } = useTheme();
  const headerArt = mode === 'night'
    ? require('../../assets/drawer-night-header.webp')
    : require('../../assets/drawer-day-header.webp');
  const cityArt = mode === 'night'
    ? require('../../assets/drawer-night-city.webp')
    : require('../../assets/drawer-day-city.webp');
  const headerH = panelWidth / HEADER_RATIO;
  const cityH = panelWidth / CITY_RATIO;
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

      {/* The city is PINNED to the foot of the panel, not carried in the scroll flow. As a
          flow element it ended wherever the content happened to end, so any scroll exposed a
          band of bare cream beneath it. Anchored to the bottom it is simply where the panel
          stops, at every scroll position, and the content scrolls over it. Both modes now:
          day's city used to be the tail of one full-height plate and is its own file. */}
      <Image
        source={cityArt}
        style={[styles.art, { width: panelWidth, height: cityH }]}
        resizeMode="cover"
      />

      <ScrollView
        contentContainerStyle={[
          styles.panelContent,
          { paddingBottom: cityH * 0.62 + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Each mode wears one supplied plate: corners, vines, rose, its own celestial mark
            (sun by day, crescent by night), STORYMAP and the rule beneath it. Full bleed to
            the top and both sides -- the negative margins cancel the panel's own padding.
            The plates are cropped to flat parchment at the foot rather than carrying an alpha
            ramp, and the panel colour is sampled from that edge, so the join needs nothing
            drawn over it.

            The project title is printed into the plate's own clear band rather than laid out
            after it: absolutely positioned inside this wrapper, so it cannot push the menu
            down and the picture keeps its measured proportions. */}
        <View style={[styles.headerArt, { width: panelWidth, height: headerH }]}>
          <Image
            source={headerArt}
            style={{ width: panelWidth, height: headerH }}
            resizeMode="cover"
          />
          <Text
            style={[styles.plateTitle, {
              height: headerH * TITLE_BAND,
              paddingHorizontal: panelWidth * TITLE_INSET,
            }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {projectName}
          </Text>
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
        {/* A plain gold rule, as in the reference. The diamond-centred ornament reads as
            decoration competing with the section label; the reference lets the label carry
            the weight and the rule simply reach across to the chevron. */}
        <View style={styles.sectionRule} />
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
    // Inset to clear the header artwork's own top-right flourish rather than sitting across
    // it. 26/26 puts the button inside the ornament instead of on its corner.
    closeBtn: {
      position: 'absolute',
      top: 26,
      right: 26,
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
    // Inset so it sits INSIDE the header artwork's corner flourish rather than across it.
    // paddingBottom is set at the call site: it has to clear the pinned artwork, whose
    // height depends on the panel's width.
    panelContent: { padding: 24, paddingTop: 32, flexGrow: 1 },
    brand: { alignItems: 'center', marginBottom: 16 },
    brandTitle: { color: colors.gold, fontFamily: FONTS.heading, fontSize: 20, letterSpacing: 1.5, marginTop: 8 },
    brandSubtitle: { color: colors.railDim, fontFamily: FONTS.heading, fontSize: 11, letterSpacing: 3, marginTop: 4 },
    divider: { height: 1, backgroundColor: colors.railDim, marginBottom: 20 },
    dividerWrap: { marginBottom: 18, paddingHorizontal: 4 },
    // Width and height are set AT THE CALL SITE from panelWidth, not here.
    //
    // `width: undefined` with an aspectRatio was the bug: React Native falls back to an
    // Image's INTRINSIC size when width is undefined, so a 1080px-wide file laid itself out
    // as 1080 DP -- three screens tall -- and aspectRatio never got a look in. Deriving both
    // dimensions from the panel's own width is deterministic and cannot do that.
    // Sits in the plate's own clear band, below the rule and above the crop. `bottom: 0`
    // and a height of TITLE_BAND: the band IS the bottom of the image, so the title is
    // positioned by the picture rather than by a number that has to be re-measured.
    plateTitle: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1,
      textAlign: 'center',
      textAlignVertical: 'center',
      color: colors.railInk,
      fontFamily: FONTS.headingBold,
      fontSize: 19,
      letterSpacing: 2,
    },
    headerArt: {
      marginTop: -32,
      marginLeft: -24,
      marginBottom: 8,
    },
    cornerTL: { position: 'absolute', top: 10, left: 10, zIndex: 2 },
    cornerTR: { position: 'absolute', top: 10, right: 10, zIndex: 2 },
    sectionGlyph: { width: 30, alignItems: 'center', marginRight: 6 },
    sectionRuleWrap: { flex: 1, marginHorizontal: 10, justifyContent: 'center' },   // unused; kept for the day header rule
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
    // Pinned to the bottom edge of the panel. Sized at the call site from panelWidth, and
    // positioned absolutely so no amount of scrolling can reveal cream underneath it.
    art: {
      position: 'absolute',
      left: 0,
      bottom: 0,
      zIndex: 0,
    },
    section: { marginBottom: 4 },
    sectionLabel: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10 },
    sectionLabelText: { color: colors.gold, fontFamily: FONTS.heading, fontSize: 12, letterSpacing: 2 },
    sectionRule: { flex: 1, height: 1, backgroundColor: colors.railInk, opacity: 0.55, marginHorizontal: 14 },
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
