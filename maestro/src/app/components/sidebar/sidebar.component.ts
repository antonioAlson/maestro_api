import { Component, EventEmitter, Output, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

interface MenuItem {
  icon: string;
  label: string;
  route?: string;
  active?: boolean;
  children?: MenuItem[];
  iconType?: 'path' | 'custom-viewbox' | 'material-symbol';
  iconViewBox?: string;
  iconFill?: boolean;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  @Output() collapsedChange = new EventEmitter<boolean>();

  isCollapsed = true;
  currentUser$;
  expandedMenu: string | null = null;
  visibleMenuItems: MenuItem[] = [];

  menuItems: MenuItem[] = [
    {
      icon: 'home',
      iconType: 'material-symbol',
      label: 'Inicio',
      route: '/home'
    },
    {
      icon: 'folder_copy',
      label: 'Projetos',
      iconType: 'material-symbol',
      children: [
        {
          icon: 'create_new_folder',
          iconType: 'material-symbol',
          label: 'Cadastro',
          route: '/projetos/cadastro'
        },
        {
          icon: 'description',
          iconType: 'material-symbol',
          label: 'Espelhos',
          route: '/projetos/espelhos'
        }
      ]
    },
    {
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
      label: 'PCP',
      children: [
        {
          icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
          label: 'Ordens',
          route: '/pcp/ordens'
        },
        {
          icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
          label: 'Acompanhamento',
          route: '/pcp/acompanhamento'
        },
        {
          icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
          label: 'Relatórios PCP',
          route: '/pcp/relatorios'
        }
      ]
    },
    {
      icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
      label: 'Faturamento',
      route: '/faturamento'
    },
    {
      icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
      label: 'Usuários',
      children: [
        {
          icon: 'M8 7a4 4 0 118 0 4 4 0 01-8 0zm-2 10a6 6 0 0112 0v1H6v-1z',
          label: 'Gerenciar',
          route: '/users'
        },
        {
          icon: 'M12 11c1.657 0 3-1.343 3-3V7a3 3 0 10-6 0v1c0 1.657 1.343 3 3 3zm-6 9v-3a6 6 0 1112 0v3H6z',
          label: 'Acesso',
          route: '/users/acesso'
        }
      ]
    },
    {
      icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
      label: 'Configurações',
      route: '/settings'
    }
  ];

  constructor(
    private authService: AuthService,
    private router: Router,
    private elementRef: ElementRef
  ) {
    this.currentUser$ = this.authService.currentUser$;
    this.visibleMenuItems = this.menuItems;

    this.currentUser$.subscribe((user) => {
      const allowedRoutes = new Set(user?.menuAccess || []);

      if (!user || allowedRoutes.size === 0) {
        this.visibleMenuItems = this.menuItems;
        return;
      }

      this.visibleMenuItems = this.menuItems
        .map((item) => {
          if (item.children && item.children.length > 0) {
            const filteredChildren = item.children.filter(child => !child.route || allowedRoutes.has(child.route));
            if (filteredChildren.length === 0) {
              return null;
            }

            return {
              ...item,
              children: filteredChildren
            };
          }

          if (!item.route || allowedRoutes.has(item.route)) {
            return item;
          }

          return null;
        })
        .filter((item): item is MenuItem => item !== null);

      if (this.expandedMenu && !this.visibleMenuItems.some(item => item.label === this.expandedMenu)) {
        this.expandedMenu = null;
      }
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const clickedInside = this.elementRef.nativeElement.contains(target);
    
    // Ignorar cliques no botão de toggle
    const isToggleButton = target.closest('.toggle-btn');
    if (isToggleButton) {
      return;
    }
    
    if (clickedInside && this.isCollapsed) {
      // Clicar no sidebar fechado abre ele
      this.isCollapsed = false;
      this.collapsedChange.emit(this.isCollapsed);
    } else if (!clickedInside && !this.isCollapsed) {
      // Clicar fora do sidebar aberto fecha ele
      this.isCollapsed = true;
      this.collapsedChange.emit(this.isCollapsed);
    }
  }

  toggleSidebar(): void {
    this.isCollapsed = !this.isCollapsed;
    this.collapsedChange.emit(this.isCollapsed);
  }

  isActive(route: string): boolean {
    return this.router.url === route;
  }

  toggleSubmenu(label: string, event?: MouseEvent): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    // Se o sidebar estiver fechado, abrir primeiro
    if (this.isCollapsed) {
      this.isCollapsed = false;
      this.collapsedChange.emit(this.isCollapsed);
    }
    
    // Toggle do submenu
    this.expandedMenu = this.expandedMenu === label ? null : label;
  }

  isMenuExpanded(label: string): boolean {
    return this.expandedMenu === label;
  }

  onLogout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
