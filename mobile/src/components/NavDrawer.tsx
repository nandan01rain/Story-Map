import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Circle, Path, Svg } from 'react-native-svg';

import type { SlidePanelController } from '../lib/useSlidePanel';
import { FONTS, type ThemeColors, useTheme } from '../theme';
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
];

const MANAGE: DrawerItem[] = [
  { key: 'export', icon: 'download', label: 'Export' },
  { key: 'export-epub', icon: 'book-closed', label: 'Export as eBook' },
  { key: 'import', icon: 'upload', label: 'Import' },
  { key: 'read', icon: 'bookmark', label: 'Read' },
  { key: 'notes', icon: 'pin', label: 'Notes' },
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
  onOpenDocuments,
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
  onOpenDocuments: () => void;
}) {
  const [expanded, setExpanded] = useState<Set<SectionKey>>(new Set());
  const { colors } = useTheme();
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
    return item;
  });

  const manageItems = MANAGE.map((item) => {
    if (item.key === 'read') return { ...item, onPress: onOpenReader };
    if (item.key === 'notes') return { ...item, onPress: onOpenNotes };
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

      <ScrollView contentContainerStyle={styles.panelContent} showsVerticalScrollIndicator={false}>
        <View style={styles.brand}>
          <CompassIcon color={colors.gold} />
          <Text style={styles.brandTitle}>{projectName}</Text>
          <Text style={styles.brandSubtitle}>STORYMAP</Text>
        </View>
        <View style={styles.divider} />

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

        <View style={styles.epigraphBox}>
          <Text style={styles.epigraphText}>Chart the past.{'\n'}Shape the future.{'\n'}Leave your legend.</Text>
        </View>
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
        <Text style={styles.sectionLabelText}>{title.toUpperCase()}</Text>
        <View style={styles.sectionRule} />
        <Text style={[styles.sectionArrow, expanded && styles.sectionArrowOpen]}>▸</Text>
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
      borderColor: colors.border,
      backgroundColor: colors.panel,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeBtnText: { color: colors.text, fontSize: 15 },
    panelContent: { padding: 24, paddingTop: 32, paddingBottom: 40, flexGrow: 1 },
    brand: { alignItems: 'center', marginBottom: 16 },
    brandTitle: { color: colors.gold, fontFamily: FONTS.heading, fontSize: 20, letterSpacing: 1.5, marginTop: 8 },
    brandSubtitle: { color: colors.textDim, fontFamily: FONTS.heading, fontSize: 11, letterSpacing: 3, marginTop: 4 },
    divider: { height: 1, backgroundColor: colors.border, marginBottom: 20 },
    section: { marginBottom: 4 },
    sectionLabel: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10 },
    sectionLabelText: { color: colors.gold, fontFamily: FONTS.heading, fontSize: 12, letterSpacing: 2 },
    sectionRule: { flex: 1, height: 1, backgroundColor: colors.border },
    sectionArrow: { color: colors.gold, fontSize: 12, transform: [{ rotate: '0deg' }] },
    sectionArrowOpen: { transform: [{ rotate: '90deg' }] },
    item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingLeft: 8, gap: 14 },
    itemPressed: { backgroundColor: 'rgba(120,100,60,0.12)' },
    itemIcon: { width: 22, alignItems: 'center' },
    itemLabel: { color: colors.text, fontSize: 14.5, letterSpacing: 0.5, flex: 1 },
    itemLabelDisabled: { color: colors.textDim },
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
    epigraphBox: {
      marginTop: 28,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 4,
      padding: 18,
    },
    epigraphText: { color: colors.textDim, fontFamily: FONTS.literaryItalic, fontSize: 12.5, textAlign: 'center', lineHeight: 20 },
  });
}
