import { connect } from "datocms-plugin-sdk";
import "datocms-react-ui/styles.css";
import ConfigScreen from "./entrypoints/ConfigScreen";
import DatoBlamePage from "./entrypoints/DatoBlamePage";
import { render } from "./utils/render";

connect({
  renderConfigScreen(ctx) {
    return render(<ConfigScreen ctx={ctx} />);
  },
  settingsAreaSidebarItemGroups() {
    return [
      {
        label: 'DatoBlame',
        items: [
          {
            label: 'DatoBlame',
            icon: 'user-clock',
            pointsTo: { pageId: 'datoblame' },
          },
        ],
      },
    ];
  },
  renderPage(pageId, ctx) {
    if (pageId === 'datoblame') {
      return render(<DatoBlamePage ctx={ctx} />);
    }
  },
});
